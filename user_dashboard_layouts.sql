-- User-editable dashboard layouts
-- Stores per-user widget arrangement (add/remove/resize/move)

create table if not exists user_dashboard_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_dashboard_layouts enable row level security;

drop policy if exists "users read own dashboard layout" on user_dashboard_layouts;
create policy "users read own dashboard layout" on user_dashboard_layouts
  for select using (user_id = auth.uid());

drop policy if exists "users manage own dashboard layout" on user_dashboard_layouts;
create policy "users manage own dashboard layout" on user_dashboard_layouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
