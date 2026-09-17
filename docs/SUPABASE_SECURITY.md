# All Christian Songs — Supabase Security Audit & Foundation

> **Phase**: 1 — Supabase Security Foundation
> **Date**: 2026-09-17
> **Status**: MIGRATION SQL READY — PENDING MANUAL APPLICATION

---

## 1. Current Architecture

| Component | Value |
|-----------|-------|
| Supabase Project URL | `https://hxfeluhttsifwmwltjmj.supabase.co` |
| Project Ref | `hxfeluhttsifwmwltjmj` |
| Client Key Type | Anon/Publishable (`sb_publishable_...`) |
| Service Role Key | **NOT PRESENT** in repository |
| Auth Provider | Not configured (anonymous sign-in disabled) |
| Existing Tables | `pinned_songs` only |

---

## 2. Verified Current RLS State

### pinned_songs

| Check | Result | Method |
|-------|--------|--------|
| RLS Enabled | **NO** | Verified via live anonymous INSERT/UPDATE/DELETE tests |
| RLS Policies | **NONE** | No policies exist |
| Anonymous SELECT | ✅ **ALLOWED** (HTTP 200) | Verified via REST API |
| Anonymous INSERT | ⚠️ **ALLOWED** (HTTP 201) | Verified via REST API — test row created and cleaned up |
| Anonymous UPDATE | ⚠️ **ALLOWED** (HTTP 204) | Verified via REST API |
| Anonymous DELETE | ⚠️ **ALLOWED** (HTTP 204) | Verified via REST API |
| Authenticated Users | **NONE** | Auth endpoint returned `anonymous_provider_disabled` |

### Existing pinned_songs Schema

```
id                    TEXT (primary key)
slug                  TEXT
title                 TEXT
title_transliterated  TEXT
author                TEXT
language              TEXT
youtube_id            TEXT
ppt_url               TEXT
chords                BOOLEAN
pin_number            INTEGER
pinned_at             TIMESTAMPTZ
```

### Existing Data

- **1 row** currently in `pinned_songs`:
  - Song: "అంకితం ప్రభూ నా జీవితం" (Ankitham Prabhu Naa Jeevitham)
  - Pinned at: 2026-09-17T04:16:54.646+00:00

---

## 3. Existing Grants

**NOT VERIFIED** — Cannot inspect PostgreSQL grants without service_role key or direct database connection. The anon key provides full CRUD access due to RLS being disabled, which implies the `anon` role has been granted all privileges on `pinned_songs`.

---

## 4. Security Vulnerabilities

### CRITICAL: No RLS on pinned_songs

Any user with the public anon key (which is in the JavaScript bundle) can:
- INSERT arbitrary rows
- UPDATE any existing row
- DELETE all pinned songs

**Impact**: An attacker could vandalize the church's Sunday service song display.

### CRITICAL: Hardcoded Admin Password

The password `sherwin1990` appears in **9 locations** across the codebase:

| # | File | Line | Context | In Production Bundle? |
|---|------|------|---------|-----------------------|
| 1 | `.env` | 6 | `VITE_ADMIN_PASSWORD=sherwin1990` | No (.gitignored) |
| 2 | `.env.local` | 6 | `VITE_ADMIN_PASSWORD=sherwin1990` | No (.gitignored) |
| 3 | `vite.config.js` | 45 | Fallback: `process.env.VITE_ADMIN_PASSWORD \|\| 'sherwin1990'` | No (server-side only) |
| 4 | `src/utils/pinManager.js` | 268 | `password: 'sherwin1990'` in syncToVercelApi | **YES** ⚠️ |
| 5 | `src/components/AdminLoginModal.jsx` | 38 | Fallback check: `password.trim() === 'sherwin1990'` | **YES** ⚠️ |
| 6 | `src/components/AdminLoginModal.jsx` | 49 | Offline fallback: `password.trim() === 'sherwin1990'` | **YES** ⚠️ |
| 7 | `src/components/SongDetail.jsx` | 123 | Pin prompt: `pass !== 'sherwin1990'` | **YES** ⚠️ |
| 8 | `src/components/SongDetail.jsx` | 147 | Unpin prompt: `pass !== 'sherwin1990'` | **YES** ⚠️ |
| 9 | `api/pinned-songs.js` | 26 | Serverless fallback: `'sherwin1990'` | No (server-side) |
| 10 | `api/publish-song.js` | 22 | Serverless fallback: `'sherwin1990'` | No (server-side) |

**5 occurrences reach the production JavaScript bundle** and are visible to anyone who inspects the browser's JavaScript.

### HIGH: Client-Side Admin Authorization via sessionStorage

Admin status is stored as `sessionStorage.setItem('jhf_is_admin', 'true')` and checked with `sessionStorage.getItem('jhf_is_admin') === 'true'`.

| File | Lines | Usage |
|------|-------|-------|
| `AdminLoginModal.jsx` | 32, 39, 50 | Sets `jhf_is_admin` on successful password |
| `SongDetail.jsx` | 33, 86, 129, 152 | Reads and sets `jhf_is_admin` |
| `App.jsx` | 53, 61 | Reads `jhf_is_admin` to determine admin state |

**Impact**: Any user can open browser DevTools and run `sessionStorage.setItem('jhf_is_admin', 'true')` to gain admin UI access. Combined with the lack of RLS, this grants full database write access.

### MODERATE: API Endpoint Password-Based Auth

Both serverless endpoints (`api/pinned-songs.js`, `api/publish-song.js`) use password-based authorization with a plaintext comparison. The password is sent in the request body.

### LOW: CORS Wildcard

Both API endpoints set `Access-Control-Allow-Origin: '*'`, allowing any domain to make requests.

---

## 5. Applied Changes

### Migration SQL Created

File: [`supabase/migrations/001_security_foundation.sql`](file:///e:/WorkSpaceOne/Google/ChristianLyricsWeb/supabase/migrations/001_security_foundation.sql)

This migration:

1. **Creates `profiles` table** — Links `auth.users` to application roles (`user`, `admin`)
2. **Enables RLS on `profiles`** — Public SELECT, self-only INSERT/UPDATE
3. **Creates signup trigger** — Auto-creates profile row when a user signs up
4. **Creates `updated_at` trigger** — Auto-updates timestamp on profile changes
5. **Enables RLS on `pinned_songs`** — Blocks all anonymous writes
6. **Creates SELECT policy** — Public read access preserved
7. **Creates INSERT/UPDATE/DELETE policies** — Admin-only (via `profiles.role = 'admin'`)

### ⚠️ MIGRATION NOT YET APPLIED

The migration SQL file is ready but **has NOT been executed** against the live database.

**Reason**: Cannot execute raw SQL via the Supabase REST API with the anon key. The Supabase Dashboard or CLI with authentication is required.

**To apply**, the user must:

1. Open the Supabase Dashboard: https://supabase.com/dashboard/project/hxfeluhttsifwmwltjmj/sql/new
2. Paste the contents of `supabase/migrations/001_security_foundation.sql`
3. Click "Run"
4. Verify success

---

## 6. API Endpoint Security Assessment

### `/api/pinned-songs.js`

| Aspect | Assessment |
|--------|-----------|
| Auth Method | Plaintext password in request body |
| Password Source | `process.env.VITE_ADMIN_PASSWORD \|\| 'sherwin1990'` |
| Bypasses RLS? | **YES** — Uses anon key directly against Supabase REST API |
| Write Protection | Password check only (no RLS, no JWT) |
| Read Protection | None (public GET, no password required) |
| Future Disposition | Replace with authenticated Supabase client in Phase 8. Until then, keep as legacy fallback for pin writes. After RLS is enabled, anonymous writes via this endpoint will fail unless it uses service_role key. |

### `/api/publish-song.js`

| Aspect | Assessment |
|--------|-----------|
| Auth Method | Plaintext password in request body or header |
| Password Source | `process.env.VITE_ADMIN_PASSWORD \|\| 'sherwin1990'` |
| Storage Backend | Vercel KV / Upstash Redis (not Supabase) |
| Bypasses RLS? | N/A — Does not touch Supabase tables |
| Future Disposition | Replace with authenticated Supabase song CRUD in Phase 9 |

---

## 7. Environment / Secrets Assessment

| File | Tracked in Git? | Contains Secrets? | Risk |
|------|-----------------|-------------------|------|
| `.env` | ❌ No (`.gitignored`) | Admin password, anon key | LOW — anon key is public by design |
| `.env.local` | ❌ No (`.gitignored`) | Same as `.env` | LOW |
| Source code | ✅ Yes | Admin password hardcoded in 5 bundled files | **HIGH** — password visible in production JS |

### VITE_* Variables

| Variable | Appropriate? |
|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ Yes — public project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes — publishable key, designed for client use |
| `VITE_ADMIN_PASSWORD` | ⚠️ **NO** — `VITE_` prefix exposes it to the client bundle. However, it's also hardcoded in source, so the env var exposure is secondary to the hardcoded strings. |

### Service Role Key

**NOT present** anywhere in the repository. This is correct — the service_role key should never appear in client code.

---

## 8. Proposed Future Auth Architecture

```
User Sign-up/Login
       ↓
  Supabase Auth (auth.users)
       ↓
  on_auth_user_created trigger
       ↓
  profiles table (role: 'user' default)
       ↓
  Manual admin promotion via Dashboard:
    UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>'
       ↓
  RLS policies check profiles.role = 'admin'
       ↓
  Admin gets INSERT/UPDATE/DELETE on pinned_songs
  Public gets SELECT only
```

---

## 9. Remaining Work (Deferred)

| Item | Target Phase |
|------|-------------|
| **Apply migration SQL** | Phase 1 (manual step required) |
| Remove hardcoded passwords from source | Phase 8 |
| Replace sessionStorage admin with Supabase Auth | Phase 8 |
| Implement login/register UI | Phase 8 |
| Create first admin user | Phase 8 |
| Update API endpoints to use JWT auth | Phase 8-9 |
| Remove VITE_ADMIN_PASSWORD env var | Phase 8 |
| Add service_role key for server-side operations | Phase 8-9 |

---

## 10. Impact on Existing Functionality

### Before Migration Applied

Everything works as-is. No changes to application behavior.

### After Migration Applied

| Operation | Before | After |
|-----------|--------|-------|
| Public: View pinned songs | ✅ Works | ✅ Works (SELECT policy allows) |
| Admin: Pin songs via client | ✅ Works (no RLS) | ❌ **Will fail** (anonymous INSERT blocked) |
| Admin: Unpin songs via client | ✅ Works (no RLS) | ❌ **Will fail** (anonymous DELETE blocked) |
| Admin: Update pin order via client | ✅ Works (no RLS) | ❌ **Will fail** (anonymous UPDATE blocked) |
| API: GET /api/pinned-songs | ✅ Works | ✅ Works (SELECT allowed) |
| API: POST /api/pinned-songs | ✅ Works | ❌ **Will fail** (anonymous INSERT blocked) |

> **IMPORTANT**: After applying the migration, admin pin/unpin functionality will break until Supabase Auth is implemented in Phase 8. The `pinManager.js` currently uses the anonymous client for writes. This is an **expected and acceptable trade-off** — security comes before convenience. The pinned songs data is preserved and readable; only write operations are blocked.

> **Mitigation**: If pin functionality is urgently needed before Phase 8, a temporary workaround would be to directly use the Supabase Dashboard Table Editor to manage pinned songs manually.
