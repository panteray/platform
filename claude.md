# CASDEX Platform — Production / Deployment Repository

## Overview
This is the **production/deployment version** of the CASDEX SaaS platform.

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
- Progressive development occurs in this repo
- Deployed to Google Cloud Run via Cloud Build CI/CD

## Architecture Rules  
Key points: OPP-based primary keys, org_id scoping, always-editable fields.

## Git Operations
**IMPORTANT:** Confirm you are in the correct directory:
```bash
cd ~/projects/platform
```
