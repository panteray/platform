-- =========================================================================
-- VAULT SCHEMA — per-OPP vaults + per-user vaults
-- Run in Supabase SQL Editor (project: znepjevqtbhijqvlxpmq)
-- =========================================================================

-- Enum for vault kind (start with opp + user; room to grow)
do $$ begin
  create type vault_type as enum ('opp', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vault_item_type as enum ('uploaded', 'generated');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------
-- document_vaults: one row per opp (auto), one per user (on demand)
-- -------------------------------------------------------------------------
create table if not exists document_vaults (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  opp_id      uuid references opportunities(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,
  vault_type  vault_type not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint document_vaults_opp_xor_user check (
    (vault_type = 'opp'  and opp_id  is not null and user_id is null) or
    (vault_type = 'user' and user_id is not null and opp_id  is null)
  )
);

create unique index if not exists document_vaults_opp_unique
  on document_vaults(opp_id) where opp_id is not null;

create unique index if not exists document_vaults_user_unique
  on document_vaults(user_id, org_id) where user_id is not null;

create index if not exists document_vaults_org_idx on document_vaults(org_id);

-- -------------------------------------------------------------------------
-- vault_folders: nested folders inside a vault
-- -------------------------------------------------------------------------
create table if not exists vault_folders (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  vault_id          uuid not null references document_vaults(id) on delete cascade,
  parent_folder_id  uuid references vault_folders(id) on delete cascade,
  name              text not null,
  sort_order        int not null default 0,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now()
);

create index if not exists vault_folders_vault_idx on vault_folders(vault_id);
create index if not exists vault_folders_parent_idx on vault_folders(parent_folder_id);

-- -------------------------------------------------------------------------
-- vault_items: files inside a vault (optionally in a folder)
-- -------------------------------------------------------------------------
create table if not exists vault_items (
  id          uuid primary key default gen_random_uuid(),
  vault_id    uuid not null references document_vaults(id) on delete cascade,
  folder_id   uuid references vault_folders(id) on delete set null,
  item_type   vault_item_type not null default 'uploaded',
  name        text not null default '',
  file_url    text,
  version     int not null default 1,
  sort_order  int not null default 0,
  metadata    jsonb not null default '{}',
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists vault_items_vault_idx on vault_items(vault_id);
create index if not exists vault_items_folder_idx on vault_items(folder_id);

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
alter table document_vaults enable row level security;
alter table vault_folders  enable row level security;
alter table vault_items    enable row level security;

drop policy if exists "vaults: members read" on document_vaults;
create policy "vaults: members read" on document_vaults for select
  using (org_id in (select org_id from users where auth_id = auth.uid()));

drop policy if exists "vaults: service-role manages" on document_vaults;
create policy "vaults: service-role manages" on document_vaults for all
  using (true) with check (true);

drop policy if exists "vault_folders: members read" on vault_folders;
create policy "vault_folders: members read" on vault_folders for select
  using (org_id in (select org_id from users where auth_id = auth.uid()));

drop policy if exists "vault_folders: service-role manages" on vault_folders;
create policy "vault_folders: service-role manages" on vault_folders for all
  using (true) with check (true);

drop policy if exists "vault_items: members read" on vault_items;
create policy "vault_items: members read" on vault_items for select
  using (vault_id in (
    select id from document_vaults where org_id in
      (select org_id from users where auth_id = auth.uid())
  ));

drop policy if exists "vault_items: service-role manages" on vault_items;
create policy "vault_items: service-role manages" on vault_items for all
  using (true) with check (true);

-- -------------------------------------------------------------------------
-- Storage bucket
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vault-docs', 'vault-docs', false)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- Backfill: one opp vault per existing opportunity
-- -------------------------------------------------------------------------
insert into document_vaults (org_id, opp_id, vault_type)
select org_id, id, 'opp'
from opportunities o
where not exists (
  select 1 from document_vaults v where v.opp_id = o.id
);

-- -------------------------------------------------------------------------
-- Trigger: auto-create opp vault on new opportunity
-- -------------------------------------------------------------------------
create or replace function create_opp_vault() returns trigger as $$
begin
  insert into document_vaults (org_id, opp_id, vault_type)
  values (new.org_id, new.id, 'opp')
  on conflict do nothing;
  return new;
end $$ language plpgsql security definer;

drop trigger if exists trg_create_opp_vault on opportunities;
create trigger trg_create_opp_vault
  after insert on opportunities
  for each row execute function create_opp_vault();
