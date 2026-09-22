# Vendor Auth → Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move vendor login onto Supabase Auth (hashed passwords), enforce `@sguk.ac.in` for student Google sign-in, and delete the legacy plaintext-password path.

**Architecture:** Vendors authenticate with email + password via `supabase.auth.signInWithPassword`; passwords live hashed in `auth.users` and are set only by admins through the `provision-vendor` / `update-vendor-password` Edge Functions. Students and admins use Google OAuth; students are restricted to the `@sguk.ac.in` domain. The legacy `verify_vendor_login` RPC and all plaintext `system_password` storage are removed.

**Tech Stack:** React (Vite), Supabase JS v2 (`supabase.auth`, `supabase.functions`), Supabase Edge Functions (Deno), PostgreSQL, Node/Express test suite.

**Spec:** `docs/superpowers/specs/2026-09-22-vendor-auth-supabase-migration-design.md`

## Global Constraints

- No plaintext passwords in the database, git, or `localStorage`. Ever.
- Password minimum length: 8 characters (matches the `update-vendor-password` Edge Function).
- Student Google email domain: exactly `@sguk.ac.in`. Admins (allowlist) and vendors (`accounts.role='vendor'`) are exempt.
- Admin allowlist source of truth: `src/utils/auth.js` `isAdminEmail` + `public.admin_allowlist`.
- Steps marked **(USER-RUN)** are executed by the user (they hold Supabase CLI + dashboard access). All other steps are code edits in this repo.
- Ordering is load-bearing: deploy + provision (Tasks 1–2) MUST land before the legacy login path is removed (Task 3), or existing vendors are locked out.

---

### Task 1: Deploy the three Edge Functions (USER-RUN)

**Files:**
- Deploy (no edits): `supabase/functions/provision-vendor/index.ts`, `supabase/functions/update-vendor-password/index.ts`, `supabase/functions/delete-vendor/index.ts`

**Interfaces:**
- Produces: live `provision-vendor`, `update-vendor-password`, `delete-vendor` functions callable via `supabase.functions.invoke(...)`. `provision-vendor` returns `{ success, email, stallId, tempPassword, userId }`. `update-vendor-password` returns `{ success, message }`.

- [ ] **Step 1: Confirm the project is linked**

Run:
```bash
supabase projects list
supabase link --project-ref <PROJECT_REF>
```
Expected: the project shows as linked. (`<PROJECT_REF>` is the ref from the Supabase dashboard URL.)

- [ ] **Step 2: Deploy the functions**

Run:
```bash
supabase functions deploy provision-vendor
supabase functions deploy update-vendor-password
supabase functions deploy delete-vendor
```
Expected: each reports a successful deploy. Service-role/anon/url secrets are injected by the platform automatically — no secret setup needed.

- [ ] **Step 3: Verify they are live**

Run:
```bash
supabase functions list
```
Expected: all three appear with status ACTIVE. No commit (no repo changes).

---

### Task 2: Provision existing vendor(s) as real Auth users (USER-RUN)

**Files:** none (operational).

**Interfaces:**
- Consumes: deployed `provision-vendor` (Task 1).
- Produces: an `auth.users` row for each existing vendor, linked `accounts`/`vendors`/`stalls` rows, and a fresh temp password per vendor. This invalidates the leaked `narayana` seed password.

- [ ] **Step 1: Sign in as an admin**

In the app, sign in with an allowlisted admin Google account (e.g. an email in `src/utils/auth.js` `ADMIN_EMAILS`). This is required because `provision-vendor` authorizes the caller as admin.

- [ ] **Step 2: Provision the `narayana` vendor via the admin dashboard**

In the app: **Admin → Vendors → Add vendor (manual)**. Enter:
- Email: `narayana2026@gmail.com`
- Business name: `Narayana`
- Stall id: `narayana`

Submit. The UI (`OnboardingModule` → `api.onboarding.manualCreate` → `provision-vendor`) returns a **temp password shown once**. Record it and hand it to the vendor.

- [ ] **Step 3: (Fallback) provision via direct call if the UI is unavailable**

Get the admin access token from the browser console while signed in:
```js
(await supabase.auth.getSession()).data.session.access_token
```
Then:
```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/provision-vendor" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"narayana2026@gmail.com","stallId":"narayana","data":{"business_name":"Narayana","full_name":"Narayana Vendor"}}'
```
Expected: JSON `{"success":true,...,"tempPassword":"Sb-...Aa1"}`.

- [ ] **Step 4: Verify the auth user exists**

In Supabase SQL Editor:
```sql
SELECT u.email, a.role, a.shop_id
FROM auth.users u
JOIN public.accounts a ON a.id = u.id
WHERE u.email = 'narayana2026@gmail.com';
```
Expected: one row, `role = 'vendor'`, `shop_id = 'narayana'`. No commit.

---

### Task 3: Rewrite `loginStaff` to use Supabase Auth only

**Files:**
- Modify: `src/api.js` (the `loginStaff` method, currently lines ~297–506)

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`, `supabase.from('accounts')`, `isAdminEmail` (already imported at `src/api.js:3`).
- Produces: `loginStaff(username, password) -> { success, token, user: { id, username, name, role, shopId } }` on success, or `{ success:false, message }` on failure. Same shape `LoginPage.handleStaffLogin` already consumes (`src/pages/LoginPage.jsx:212`).

- [ ] **Step 1: Replace the entire `loginStaff` method body**

In `src/api.js`, replace the whole method (from `async loginStaff(username, password) {` through its closing `},` at ~line 506) with:

```js
  async loginStaff(username, password) {
    const input = (username || '').trim().toLowerCase();
    const pwd = (password || '').trim();
    if (!input || !pwd) {
      return { success: false, message: 'Email and Password are required.' };
    }
    if (!input.includes('@')) {
      return { success: false, message: 'Please sign in with your registered email address.' };
    }

    // Authenticate against Supabase Auth (passwords are bcrypt-hashed in auth.users).
    const { data, error } = await supabase.auth.signInWithPassword({ email: input, password: pwd });
    if (error || !data?.user) {
      return { success: false, message: 'Invalid email or password.' };
    }

    const authUser = data.user;
    const token = data.session?.access_token || null;

    // Resolve role + shop from the accounts profile (accounts.id === auth user id).
    let profile = null;
    try {
      const { data: acct } = await supabase
        .from('accounts')
        .select('role, shop_id, full_name')
        .eq('id', authUser.id)
        .maybeSingle();
      profile = acct || null;
    } catch (_e) {}

    let role = profile?.role || authUser.app_metadata?.role || authUser.user_metadata?.role || 'vendor';
    if (isAdminEmail(input)) role = 'admin';

    const shopId = profile?.shop_id || authUser.app_metadata?.shopId || null;
    const name = profile?.full_name || authUser.user_metadata?.full_name || input.split('@')[0];

    return {
      success: true,
      token,
      user: { id: authUser.id, username: input, name, role, shopId }
    };
  },
```

- [ ] **Step 2: Remove now-dead helpers used only by the old body**

In `src/api.js`, delete the `checkVendorPassword` inner function if it now has no remaining references. Search the file:
```bash
grep -n "checkVendorPassword" src/api.js
```
Expected after deletion: no matches. Leave `parseDetails` / `isUUID` in place (used elsewhere).

- [ ] **Step 3: Build the frontend to catch syntax/reference errors**

Run:
```bash
npm run build
```
Expected: build succeeds with no "is not defined" / unresolved-reference errors from `src/api.js`.

- [ ] **Step 4: Manual login check**

With the dev server (`npm run dev`), open `/login`, use the staff form with `narayana2026@gmail.com` + the temp password from Task 2.
Expected: login succeeds and routes to the vendor dashboard. The old `narayana2026` password now fails with "Invalid email or password."

- [ ] **Step 5: Commit**

```bash
git add src/api.js
git commit -m "refactor(auth): vendor login uses Supabase Auth only, drop plaintext path"
```

---

### Task 4: Admin vendor-password reset → `update-vendor-password` Edge Function

**Files:**
- Modify: `src/api.js` (the `onboarding.resetPassword` method, currently lines ~1508–1573)

**Interfaces:**
- Consumes: `supabase.functions.invoke('update-vendor-password', { body: { email, password } })`.
- Produces: `onboarding.resetPassword(email, newPassword) -> { success:true, message }`; throws `Error` on failure. Caller `OnboardingModule.handleResetPassword` (`src/components/admin/OnboardingModule.jsx:56`) passes `(cleanEmail, newPwd, v.id)`; the third arg is now ignored (kept for call-site compatibility).

- [ ] **Step 1: Replace the `resetPassword` method body**

In `src/api.js`, replace the whole `resetPassword: async (email, newPassword, stallId) => { ... }` block with:

```js
    resetPassword: async (email, newPassword) => {
      const cleanEmail = (email || '').trim().toLowerCase();
      const pwd = (newPassword || '').trim();
      if (!cleanEmail) throw new Error('Vendor email address is required.');
      if (pwd.length < 8) throw new Error('Password must be at least 8 characters long.');

      // Password is set (bcrypt-hashed) in auth.users by the admin-only Edge Function.
      // Nothing is written to any plaintext column.
      const { data, error } = await supabase.functions.invoke('update-vendor-password', {
        body: { email: cleanEmail, password: pwd }
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to update vendor password.');
      }
      return { success: true, message: data.message || 'Vendor password updated.' };
    }
```

- [ ] **Step 2: Confirm no other caller relied on the old plaintext behavior**

Run:
```bash
grep -rn "onboarding.resetPassword\|\.resetPassword(" src/
```
Expected: only `src/components/admin/OnboardingModule.jsx` calls it. No code depends on the removed `vendors.details.system_password` write.

- [ ] **Step 3: Build**

Run:
```bash
npm run build
```
Expected: success.

- [ ] **Step 4: Manual reset check**

As admin, open **Vendors → (a provisioned vendor) → reset password**, set an 8+ char password. Then log in as that vendor with the new password.
Expected: reset reports success; vendor logs in with the new password; old password fails.

- [ ] **Step 5: Commit**

```bash
git add src/api.js
git commit -m "refactor(onboarding): vendor password reset goes through update-vendor-password edge function"
```

---

### Task 5: Enforce `@sguk.ac.in` for student Google sign-in

**Files:**
- Modify: `src/pages/LoginPage.jsx` (`handleGoogleLogin` ~line 181, and the `onAuthStateChange` handler ~lines 241–268)

**Interfaces:**
- Consumes: `supabase.auth.signOut`, `isAdminEmail` (already imported in `LoginPage.jsx`), the `profile` fetched from `accounts` in the handler.
- Produces: no new exports. Behavior: non-admin, non-vendor Google users whose email is not `@sguk.ac.in` are signed out with an error and never reach `finish(...)`.

- [ ] **Step 1: Add the Google hosted-domain hint**

In `src/pages/LoginPage.jsx`, in `handleGoogleLogin`'s `signInWithOAuth` call, change the `queryParams` to include `hd`:

```js
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: { prompt: 'select_account', access_type: 'offline', hd: 'sguk.ac.in' }
        }
```

- [ ] **Step 2: Add the enforcement gate in `onAuthStateChange`**

In the same file, inside the `onAuthStateChange` handler, after `profile` is fetched and immediately before the role is computed (`const role = isAdminEmail(userEmail) ? ...`), insert:

```js
        // Domain gate: only admins (allowlist) and provisioned vendors may use a
        // non-@sguk.ac.in Google account. Everyone else must be @sguk.ac.in.
        const isAdmin = isAdminEmail(userEmail);
        const isVendor = profile?.role === 'vendor';
        if (!isAdmin && !isVendor && !userEmail.endsWith('@sguk.ac.in')) {
          await supabase.auth.signOut();
          localStorage.removeItem('sgu_google_oauth_started');
          setIsLoading(false);
          setErrorMsg('Please sign in with your @sguk.ac.in institutional Google account.');
          return;
        }
```

- [ ] **Step 3: Build**

Run:
```bash
npm run build
```
Expected: success.

- [ ] **Step 4: Manual domain checks**

- Sign in with a non-`@sguk.ac.in`, non-admin Google account → rejected, signed out, error shown.
- Sign in with a `@sguk.ac.in` account → routes to the student area.
- Sign in with an allowlisted admin account → routes to admin.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LoginPage.jsx
git commit -m "feat(auth): restrict student google sign-in to @sguk.ac.in"
```

---

### Task 6: Remove the forgot/reset-password flow

**Files:**
- Delete: `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx`, `server/send-reset-email.js`
- Modify: `src/App.jsx` (remove the two lazy imports at lines ~44–45)

**Interfaces:**
- Consumes: nothing new.
- Produces: no forgot/reset pages. Routes `/forgot-password` and `/reset-password` continue to `<Navigate to="/login" replace />` (already defined at `src/App.jsx:192-193`) so old bookmarks land on the login page.

- [ ] **Step 1: Delete the page components and the orphaned email handler**

```bash
git rm src/pages/ForgotPassword.jsx src/pages/ResetPassword.jsx server/send-reset-email.js
```
(`server/send-reset-email.js` is orphaned — its only caller was `ForgotPassword.jsx`, and it is not wired into `api/index.js`.)

- [ ] **Step 2: Remove the now-unused lazy imports**

In `src/App.jsx`, delete these two lines (~44–45):

```js
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
```

- [ ] **Step 3: Confirm nothing else references the deleted symbols**

Run:
```bash
grep -rn "ForgotPassword\|ResetPassword\|send-reset-email" src/ server/ api/
```
Expected: no matches (the redirect routes at `src/App.jsx:192-193` reference the path strings, not the components — those stay).

- [ ] **Step 4: Build**

Run:
```bash
npm run build
```
Expected: success, no unresolved imports.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(auth): remove dead forgot/reset-password flow"
```

---

### Task 7: Drop the legacy RPC and scrub plaintext from schema/seed

**Files:**
- Modify: `master_supabase_complete_schema.sql` (remove the `verify_vendor_login` function block ~lines 528–606, and fix the seed ~lines 619–636)
- Delete: `supabase/migrations/20260917_verify_vendor_login.sql`
- **(USER-RUN)** SQL against the live database

**Interfaces:**
- Consumes: nothing.
- Produces: no `verify_vendor_login` function anywhere; seed contains no login secret and no invalid `accounts` insert.

- [ ] **Step 1: Remove the `verify_vendor_login` function from the schema file**

In `master_supabase_complete_schema.sql`, delete the entire block from the `CREATE OR REPLACE FUNCTION public.verify_vendor_login(...)` header (and its preceding comment) through the line:
```sql
GRANT EXECUTE ON FUNCTION public.verify_vendor_login(TEXT, TEXT) TO anon, authenticated, service_role;
```
(currently ending at line 606). Leave the `-- REALTIME` block that follows intact.

- [ ] **Step 2: Fix the seed — no secret, no invalid accounts insert**

Replace the seed block (the vendor `INSERT` at ~625–631 and the accounts `INSERT` at ~633–636) with:

```sql
INSERT INTO public.vendors (stall_id, business_name, contact_email, vendor_status)
VALUES
  ('narayana', 'Narayana', 'narayana2026@gmail.com', 'ACTIVE')
ON CONFLICT (stall_id) DO UPDATE SET
  contact_email = EXCLUDED.contact_email,
  business_name = EXCLUDED.business_name,
  vendor_status = EXCLUDED.vendor_status;

-- NOTE: the vendor's login (auth.users row + accounts row) is created by the
-- provision-vendor Edge Function, NOT seeded here. A public.accounts row cannot
-- exist without a matching auth.users id (accounts.id references auth.users).
```
Keep the `stalls` seed (~620–623) and the final `COMMIT;` as they are. The plaintext `details` JSON and the `accounts` insert are removed entirely.

- [ ] **Step 3: Delete the migration file**

```bash
git rm supabase/migrations/20260917_verify_vendor_login.sql
```

- [ ] **Step 4: Confirm no code still calls the RPC**

Run:
```bash
grep -rn "verify_vendor_login\|system_password" src/ server/ supabase/ master_supabase_complete_schema.sql
```
Expected: no matches (all references removed).

- [ ] **Step 5: (USER-RUN) Apply to the live database**

In Supabase SQL Editor:
```sql
DROP FUNCTION IF EXISTS public.verify_vendor_login(TEXT, TEXT);
UPDATE public.vendors
SET details = (COALESCE(details, '{}'::jsonb) - 'system_password' - 'password')
WHERE details ? 'system_password' OR details ? 'password';
```
Expected: function dropped; no vendor row retains a plaintext password key. Verify:
```sql
SELECT proname FROM pg_proc WHERE proname = 'verify_vendor_login';           -- empty
SELECT stall_id FROM public.vendors WHERE details ? 'system_password';        -- empty
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "security(db): drop verify_vendor_login rpc and remove plaintext password seed"
```

---

### Task 8: Full regression verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run the existing backend test suite**

Run:
```bash
node server/tests/runAllTests.js
```
Expected: the suite passes (or matches the pre-change baseline — no new failures introduced by this work).

- [ ] **Step 2: Build the frontend clean**

Run:
```bash
npm run build
```
Expected: success.

- [ ] **Step 3: Acceptance matrix (manual)**

Verify each:
- Vendor logs in with the admin-set password; the old leaked password fails.
- `SELECT proname FROM pg_proc WHERE proname='verify_vendor_login';` returns empty.
- A Google account outside `@sguk.ac.in` (non-admin) is rejected; a `@sguk.ac.in` account signs in as student; an allowlisted admin signs in as admin.
- Adding a vendor from the dashboard creates `auth.users` + `accounts` + `vendors` + `stalls` rows, and the password set there logs the vendor in.
- Admin "reset password" changes the vendor's login; the new password works, the old one does not.

- [ ] **Step 4: Final confirmation**

No commit required (verification only). Report the acceptance matrix results.
