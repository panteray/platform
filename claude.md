# CASDEX Platform — Production / Deployment Repository

## Overview
This is the **production/deployment version** of the CASDEX SaaS platform. The active development repo is `dxtrgsprd-cyber/casdex-web`.

## Tech Stack
- **Frontend:** Next.js (App Router)
- **Backend/DB:** Supabase (Postgres + RLS + Realtime)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage — `org-assets` bucket (signed URLs)
- **Hosting:** Google Cloud Run (us-east1)
- **CI/CD:** Google Cloud Build
- **Source:** GitHub (panteray/platform)

## Infrastructure Status
| Layer    | Service                | Status                  |
|----------|------------------------|-------------------------|
| Hosting  | Google Cloud Run       | DEPLOYED                |
| CI/CD    | Google Cloud Build     | OPERATIONAL             |
| Database | Supabase PostgreSQL    | ALL MIGRATIONS APPLIED  |
| Auth     | Supabase Auth          | CONNECTED               |
| Storage  | Supabase Storage       | OPERATIONAL             |

## Role of This Repo
- Production/deployment version of the CASDEX platform
- Active development occurs in this repo
- Deployed to Google Cloud Run via Cloud Build CI/CD

## Key Differences from casdex-web
- **casdex-web** → Railway
- **platform** → Google Cloud Run (us-east1) + Cloud Build CI/CD
- Platform uses Supabase Storage with `org-assets` bucket and signed URLs

## Architecture Rules  
Key points: OPP-based primary keys, org_id scoping, always-editable fields.

## Relationship to casdex-web
redesign/ rebrand with upgraded codefeatures
```

## Git Operations
**IMPORTANT:** Before any git commands for this repo, confirm you are in the correct directory:
```bash
cd ~/projects/platform
```
Do NOT run git commands intended for this repo from the `casdex-web` directory or vice versa.
