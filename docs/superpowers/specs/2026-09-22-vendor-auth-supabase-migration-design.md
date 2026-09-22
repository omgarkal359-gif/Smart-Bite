# Design: Unify Authentication on Supabase Auth

**Date:** 2026-09-22
**Status:** Approved (pending spec review)

## Problem

Vendor login is broken and insecure. Three root problems:

1. **Two disconnected password stores.** Vendor login checks
   `vendors.details.system_password` (plaintext) via the
   `verify_vendor_login` RPC, while the "Forgot Password" flow updates
   the Supabase Auth password. They are never synced, so a password
   reset does not change what login checks.
2. **Plaintext passwords** live in the `vendors.details` JSONB column
   and in the seed SQL committed to git.
3. **Seeded vendors are absent from `auth.users`**, so any Auth-based
   flow (including password reset) cannot work for them.

The correct Supabase-Auth path is already built as three Edge Functions
(`provision-vendor`, `update-vendor-password`, `delete-vendor`) but is
dormant; the legacy plaintext path is what runs.

## Goals

- Vendors log in with email + password (manual), no domain restriction.
  Whatever password an admin sets in the dashboard is the vendor's
  login. Password is stored hashed in `auth.users`, never plaintext.
- Students log in with Google OAuth, restricted to the `@sguk.ac.in`
  domain.
- Admins log in with Google OAuth + allowlist (unchanged).
- No plaintext passwords in the database or in git.
- Adding a vendor from the dashboard writes all vendor details through
  the `stalls` / `vendors` / `accounts` tables and provisions a working
  login in one action.

## Non-goals

- Vendor self-service password reset (admin-managed only).
- Email/password self-reset for any role (removed entirely).
- RLS policy overhaul (tracked separately; not required for login to
  work).

## Roles and auth model

| Role | Login method | Password store | Domain rule |
|------|-------------|----------------|-------------|
| Student | Google OAuth | Google | must be `@sguk.ac.in` |
| Vendor | Email + password form | `auth.users` (hashed) | none |
| Admin | Google OAuth + allowlist | Google | exempt |

## Schema audit (no changes required)

Verified against `master_supabase_complete_schema.sql`:

- `accounts` (id = `auth.users.id`, `role`, `shop_id`) — the
  `handle_new_user` trigger auto-creates the row when an auth user is
  created with `app_metadata.role='vendor'` and `shopId`.
- `vendors` — every column `provision-vendor` writes exists
  (`stall_id`, `user_id`, `business_name`, `owner_name`,
  `contact_email`, `vendor_status`, `fssai`, `account_holder`, `ifsc`,
  `upi_id`, `account_last4`, `details`). Bank account number is stored
  as `account_last4` / `account_number_enc` only.
- `stalls` — all columns the provision flow writes exist.

The only schema/seed change: remove the plaintext `system_password`
seed and the `verify_vendor_login` function.

## Changes

### A. Vendor login → Supabase Auth
- Rewrite `api.loginStaff` (`src/api.js`) to call only
  `supabase.auth.signInWithPassword`, then read `role` and `shop_id`
  from `accounts` by the authenticated user id. Resolve admin via
  allowlist / `accounts.role`.
- Delete the `verify_vendor_login` RPC call, `checkVendorPassword`, and
  every plaintext / table-scan fallback in `loginStaff`.
- Drop the `verify_vendor_login` function from the database and from
  `master_supabase_complete_schema.sql`; delete the migration file
  `supabase/migrations/20260917_verify_vendor_login.sql`.

### B. Remove forgot / reset password entirely
- Delete `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx`
  and their routes in `src/main.jsx`.
- Delete the `/api/send-reset-email` serverless handler
  (`server/send-reset-email.js` and any Vercel `api/` route).
- Delete `api.onboarding.resetPassword` (the plaintext writer) from
  `src/api.js`.

### C. Admin resets vendor password via Edge Function
- Wire the Onboarding "reset password" button
  (`src/components/admin/OnboardingModule.jsx`) to call the
  `update-vendor-password` Edge Function
  (`supabase.functions.invoke('update-vendor-password', ...)`) instead
  of the deleted plaintext path.

### D. Enforce `@sguk.ac.in` for student Google sign-in
- In the OAuth `onAuthStateChange` handler (`src/pages/LoginPage.jsx`):
  after a session is established, if the user is **not** an admin
  (allowlist) and **not** a provisioned vendor (`accounts.role='vendor'`),
  require the email to end in `@sguk.ac.in`; otherwise call
  `supabase.auth.signOut()` and show a clear error.
- Add the Google `hd: 'sguk.ac.in'` hint to the `signInWithOAuth`
  `queryParams` (UX hint only; the check above is the real gate).
- Follow-up (out of scope, noted): a server-side auth hook / trigger
  rejecting non-domain student signups for defense in depth.

### E. Scrub plaintext + rotate the exposed secret
- Remove `system_password` and the plaintext vendor seed from
  `master_supabase_complete_schema.sql`. Seed only the stall + a
  non-secret vendor/account row (no login secret in SQL).
- Re-provision the `narayana` vendor as a real `auth.users` user via
  `provision-vendor`, which issues a fresh temp password and
  invalidates the leaked seed password.

## Sequencing (avoids locking anyone out)

1. Deploy the three Edge Functions.
2. Admin signs in, then provisions `narayana` (and any other existing
   vendor) → receives a fresh temp password to hand over.
3. Rewrite `loginStaff`; remove the RPC, plaintext fallbacks, and the
   forgot/reset pages.
4. Enforce the `@sguk.ac.in` domain check.
5. Scrub the schema/seed and commit.

Steps that touch the live database or deploy functions are run by the
user (they have Supabase CLI access); all code changes are made in this
repo. Exact commands are provided at each step.

## Error handling

- Vendor login failure → generic "Invalid email or password" (no
  enumeration of which field is wrong).
- Non-`@sguk.ac.in` student Google sign-in → signed out immediately with
  "Use your @sguk.ac.in institutional account."
- Edge Function calls (`provision-vendor`, `update-vendor-password`)
  surface their returned `message` to the admin UI; failures do not
  leave partial rows in an unusable state (functions upsert idempotently
  keyed on `stall_id` / auth email).

## Testing / verification

- Existing `server/tests` stay green.
- Manual acceptance:
  - Vendor logs in with the newly set password; the old leaked password
    fails.
  - `SELECT proname FROM pg_proc WHERE proname='verify_vendor_login';`
    returns empty (RPC gone).
  - A Google account outside `@sguk.ac.in` is rejected; a `@sguk.ac.in`
    account signs in as student; an allowlisted admin signs in as admin.
  - Adding a vendor from the dashboard creates the `auth.users` +
    `accounts` + `vendors` + `stalls` rows and the set password logs in.
