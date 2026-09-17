# Phase 8A — Authentication & Authorization Security Audit Report

**Project:** All Christian Songs (*Jesus Heals Fellowship Church*)  
**Date:** September 17, 2026  
**Audit Scope:** READ-ONLY inspection of Supabase Auth, PostgreSQL RLS, Application Frontend, Dev Server, and Serverless API functions.  
**Result:** **NEEDS HARDENING**

---

## Executive Summary

A comprehensive, read-only security audit was conducted on the authentication and authorization architecture of the All Christian Songs application and its Supabase database.

The database security foundation (PostgreSQL RLS, helper functions, and triggers implemented in Phases 1, 2, and 2.1) is **fully secure and verified**. All catalog tables (`songs`, `songbooks`, `songbook_songs`, `pinned_songs`, `categories`, `languages`, and `profiles`) strictly enforce Row-Level Security (RLS). Anonymous writes, updates, and deletes are 100% blocked by PostgreSQL. Profile role escalation is prevented at the database level via a `SECURITY DEFINER` trigger.

However, the **frontend application, dev server, and serverless API layers** still rely on a legacy, pre-migration administration architecture:
1. **Supabase Auth is not yet integrated into the frontend** (no login forms, session listeners, or JWT handling).
2. **A shared legacy admin password is hardcoded in plaintext** in client-side `.jsx` files and compiled into production build bundles.
3. **Frontend admin privileges depend on spoofable client-side storage** (`sessionStorage.getItem('jhf_is_admin') === 'true'`).
4. **Serverless API routes (`api/publish-song.js`) contain bypass flaws** where omitting credentials bypasses password verification.
5. **Client-side write operations fail against Supabase** because the frontend attempts writes with the anonymous key rather than an authenticated admin session.

---

## 1. Database Architecture (Supabase PostgreSQL)

### 1.1 `public.profiles` Schema & Trigger
- **Schema:**
  - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
  - `full_name TEXT`
  - `role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Role Escalation Protection (`protect_profile_role()`):**
  - Trigger: `tr_protect_profile_role BEFORE UPDATE ON public.profiles FOR EACH ROW`
  - Execution: `SECURITY DEFINER SET search_path = ''`
  - Logic: Checks `IF NEW.role IS DISTINCT FROM OLD.role THEN IF NOT public.is_admin() THEN RAISE EXCEPTION ...`
  - Protection: Prevents any user from elevating their role to `admin` or changing any other user's role.
- **New User Hook (`handle_new_user()`):**
  - Trigger: `on_auth_user_created AFTER INSERT ON auth.users`
  - Always enforces `role = 'user'` as the default role upon signup.

### 1.2 `public.is_admin()` Security Function
- **Definition:**
  ```sql
  CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    );
  $$;
  ```
- **Security Assessment:**
  - `SECURITY DEFINER`: Avoids infinite RLS recursion while querying `public.profiles`.
  - `SET search_path = ''`: Prevents schema/search-path hijacking.
  - Evaluation: Evaluates `auth.uid()` from the verified JWT. For unauthenticated/anonymous callers, `auth.uid() IS NULL` and the function returns `FALSE`. For authenticated non-admin users, it returns `FALSE`.

### 1.3 Table RLS Policies & Verification

| Table | RLS Status | Read Policy | Write Policy | Live Anon Test |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | ENABLED & FORCED | `auth.uid() = id OR public.is_admin()` | `auth.uid() = id AND role = 'user'` (insert)<br>`public.is_admin()` (update role/delete) | **BLOCKED** (0 rows read, insert rejected) |
| `songs` | ENABLED | `is_published = true OR public.is_admin()` | `public.is_admin()` | **BLOCKED** (insert/update/delete rejected) |
| `songbooks` | ENABLED | `true` (public) | `public.is_admin()` | **BLOCKED** (writes rejected) |
| `songbook_songs`| ENABLED | `true` (public) | `public.is_admin()` | **BLOCKED** (writes rejected) |
| `pinned_songs` | ENABLED & FORCED | `true` (public) | `public.is_admin()` | **BLOCKED** (0 rows modified/deleted) |
| `languages` | ENABLED | `true` (public) | `public.is_admin()` | **BLOCKED** (writes rejected) |
| `categories` | ENABLED | `true` (public) | `public.is_admin()` | **BLOCKED** (writes rejected) |

*Finding: In live testing, all anonymous INSERT, UPDATE, and DELETE queries were completely rejected or modified 0 rows. Anonymous profile harvesting returns 0 rows.*

---

## 2. Application & Frontend Architecture

### 2.1 Existing Supabase Auth Configuration
- `src/utils/supabaseClient.js` configures the Supabase JS client using the public URL and anon key (`sb_publishable_...`).
- **No Supabase Auth methods are invoked in the application code:**
  - Zero calls to `supabase.auth.signInWithPassword()`.
  - Zero calls to `supabase.auth.signOut()`.
  - Zero calls to `supabase.auth.onAuthStateChange()`.
  - Zero session context or user state management.

### 2.2 Legacy Admin Mechanisms Still Present
The frontend retains a legacy shared password system across multiple files:

1. **`src/components/AdminLoginModal.jsx`:**
   - Prompts for an admin password.
   - Attempts to call `/api/admin/verify-password`.
   - Contains a hardcoded fallback: `if (password.trim() === '[REDACTED_PASSWORD]')`.
   - On success, sets `sessionStorage.setItem('jhf_is_admin', 'true')` and broadcasts a `jhf_admin_changed` DOM event.

2. **`src/components/SongDetail.jsx`:**
   - Contains an admin unlock prompt for pinning songs.
   - Hardcodes: `if (pass !== '[REDACTED_PASSWORD]')` in `handleConfirmPin` and `handleUnpin`.
   - On matching password, sets `sessionStorage.setItem('jhf_is_admin', 'true')`.

3. **`src/utils/pinManager.js`:**
   - Hardcodes `password: '[REDACTED_PASSWORD]'` when calling `/api/pinned-songs`.
   - Calls `supabase.from('pinned_songs').upsert(...)` using the anon client. Because the anon client lacks an admin session, this call silently fails against Supabase RLS.
   - As a fallback, stores pinned songs in client `localStorage.setItem('jhf_pinned_songs_v1', ...)` and broadcasts an event, masking the database write failure from the local user.

4. **Environment Variables (`.env`, `.env.local`):**
   - Both files define `VITE_ADMIN_PASSWORD=[REDACTED_PASSWORD]`.
   - Any variable with the `VITE_` prefix is automatically embedded by Vite into the compiled client JavaScript.
   - Verification: In `dist/assets/index-C24uu_ZK.js`, the hardcoded password string is compiled directly into the client bundle and is visible to anyone inspecting developer tools.

### 2.3 Client-Side Authorization Bypass
- Frontend components (`App.jsx`, `SongDetail.jsx`, `PinnedSongsSection.jsx`, `AdminPublishModal.jsx`) rely on:
  ```javascript
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('jhf_is_admin') === 'true');
  ```
- **Vulnerability:** Any visitor can open the browser console and execute:
  ```javascript
  sessionStorage.setItem('jhf_is_admin', 'true');
  window.dispatchEvent(new CustomEvent('jhf_admin_changed', { detail: { isAdmin: true } }));
  ```
  This immediately unlocks all admin UI buttons, modal dialogs, and publishing forms.
- **Database Mitigation:** Even when the client UI is bypassed, Supabase PostgreSQL RLS continues to protect the database against unauthorized writes. However, the client can still trigger local storage overwrites and unauthenticated serverless API calls.

---

## 3. Serverless Functions & Dev Server Middleware

### 3.1 Vercel Serverless Function: `api/publish-song.js`
- **Logic Flaw (Authentication Bypass):**
  ```javascript
  const pass = body.password || req.headers['x-admin-password'];
  if (pass && pass !== ADMIN_PASS) {
    return res.status(401).json({ success: false, error: 'Unauthorized admin' });
  }
  ```
  - If `body.password` and `x-admin-password` are omitted, `pass` is `undefined`.
  - The condition `pass && pass !== ADMIN_PASS` evaluates to `false`.
  - **Result:** An unauthenticated request with no password at all bypasses the check and can publish songs to Upstash Redis KV if configured.

### 3.2 Vercel Serverless Function: `api/pinned-songs.js`
- Checks `if (password !== ADMIN_PASS)`.
- Attempts to write to Supabase `pinned_songs` using `SUPABASE_KEY` (which is configured as the anon key).
- **Result:** Supabase writes fail due to RLS, but writes to Redis KV succeed.

### 3.3 Vite Dev Server Plugin: `adminSongApiPlugin` (`vite.config.js`)
- `POST /api/admin/verify-password`: Compares with `process.env.VITE_ADMIN_PASSWORD || '[REDACTED_PASSWORD]'`.
- `POST /api/admin/publish-song`: **Does not check any password or authentication token whatsoever.** It parses the request body and writes new JSON files directly to `public/data/songs/` and `public/data/compact_index.json`. While this is only active in the Vite development server, it poses a local tampering risk.

---

## 4. Specific Audit Inquiries

| # | Inspection Item | Finding | Status |
| :--- | :--- | :--- | :--- |
| **1** | Existing Supabase Auth configuration | Client initialized with anon key in `src/utils/supabaseClient.js`. No auth methods used. | **Needs Implementation** |
| **2** | `profiles` table schema | Correct: UUID PK -> `auth.users(id)`, `role` ('user'\|'admin'), timestamps. | **PASS** |
| **3** | `profiles` RLS policies | RLS enabled and forced. Private to owner and admin. | **PASS** |
| **4** | `protect_profile_role()` function/trigger | Enforces admin check on any role change; prevents self-promotion. | **PASS** |
| **5** | `public.is_admin()` function | `SECURITY DEFINER`, `search_path = ''`, safe check against `profiles`. | **PASS** |
| **6** | `songs` RLS policies | Public read for published; admin-only INSERT, UPDATE, DELETE. | **PASS** |
| **7** | `songbook_songs` RLS policies | Public read; admin-only writes via `is_admin()`. | **PASS** |
| **8** | `pinned_songs` RLS policies | Legacy policies purged. Public read; admin-only writes via `is_admin()`. | **PASS** |
| **9** | Remaining legacy admin code | Present in `AdminLoginModal.jsx`, `SongDetail.jsx`, `pinManager.js`, `api/*.js`, `vite.config.js`. | **Needs Removal** |
| **10**| Hardcoded credentials | Present in `.env`, `.env.local`, `.jsx` components, `api/*.js`, and built `dist/`. | **Critical Finding** |
| **11**| `sessionStorage` authorization flags | `jhf_is_admin` controls UI state client-side without cryptographic proof. | **Needs Hardening** |
| **12**| Client-side admin bypass | Trivial to bypass UI via DevTools (`sessionStorage`). `api/publish-song.js` credential omission flaw. | **Needs Hardening** |
| **13**| Serverless / API functions | `api/pinned-songs.js` and `api/publish-song.js` use legacy passwords and KV; bypass in `publish-song.js`. | **Needs Hardening** |
| **14**| `service_role` in frontend code | **0 references found.** Scanned `src/` and `dist/`. | **PASS** |
| **15**| Normal user role escalation | **Database: IMPOSSIBLE.** Trigger and policies block self-promotion. | **PASS (Database)** |
| **16**| Anonymous writes to protected tables | **Database: BLOCKED.** RLS rejects all anonymous modifications. | **PASS (Database)** |
| **17**| Authenticated non-admin writes | **Database: BLOCKED.** Non-admin users cannot write to any catalog table. | **PASS (Database)** |
| **18**| Admin privileges depend on client state | **Database: NO.** Evaluated strictly server-side from JWT.<br>**Frontend: YES.** UI relies entirely on `sessionStorage`. | **Needs Hardening** |

---

## 5. Recommended Changes for Phase 8B / Migration

1. **Implement Proper Supabase Auth in Frontend:**
   - Add Supabase Auth sign-in flow (`supabase.auth.signInWithPassword({ email, password })`).
   - Create an `AuthContext` or state listener using `supabase.auth.onAuthStateChange()`.
   - Check the user's role by querying `public.profiles` or inspecting app metadata after authenticating.

2. **Eliminate All Hardcoded Credentials:**
   - Remove hardcoded password strings from `AdminLoginModal.jsx`, `SongDetail.jsx`, `pinManager.js`, `api/pinned-songs.js`, `api/publish-song.js`, and `vite.config.js`.
   - Remove `VITE_ADMIN_PASSWORD` from `.env` and `.env.local` to prevent Vite from compiling it into client bundles.

3. **Align Write Operations with Authenticated Supabase Sessions:**
   - Update `pinManager.js` to execute writes only when an authenticated admin session exists.
   - Remove client-side fallback mocks that hide RLS write failures.

4. **Deprecate or Secure Serverless API Routes:**
   - If using Supabase directly as the source of truth for pinned songs and published songs, deprecate `api/pinned-songs.js` and `api/publish-song.js`.
   - If serverless routes are retained, verify the Supabase JWT (`Authorization: Bearer <token>`) using the Supabase client rather than a static shared password string.

5. **Files Requiring Modification in Subsequent Phases:**
   - `src/components/AdminLoginModal.jsx` (replace shared password prompt with email/password Supabase Auth).
   - `src/components/SongDetail.jsx` (remove hardcoded password checks).
   - `src/utils/pinManager.js` (remove hardcoded password, use authenticated session).
   - `src/App.jsx` (derive `isAdmin` from Supabase session and profile role instead of `sessionStorage`).
   - `.env` and `.env.local` (remove `VITE_ADMIN_PASSWORD`).
   - `vite.config.js` (remove legacy dev server password verification endpoint).
   - `api/pinned-songs.js` and `api/publish-song.js` (secure or deprecate).

---

## Conclusion & Verdict

**PHASE 8A RESULT: NEEDS HARDENING**

The database layer is **PASS** with complete RLS enforcement and robust role escalation defenses. The application and API layers **NEED HARDENING** due to the presence of legacy hardcoded credentials, client-side authorization spoofing, and the absence of frontend Supabase Auth integration.
