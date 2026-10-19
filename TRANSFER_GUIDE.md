# Rental Platform transfer guide

## Requirements

- Node.js 20.19 or newer, or Node.js 22.12 or newer
- npm, which is included with Node.js
- Access to the existing Supabase project URL and public publishable key

## Set up the project on the other device

1. Install Node.js and npm from the official Node.js website.
2. Copy this ZIP through Google Drive and extract it to a local folder.
3. Open a terminal in the extracted `Rental Platform` folder.
4. Install the exact locked dependencies:

   ```bash
   npm ci
   ```

5. Create `.env.local` from `.env.example`:

   macOS or Linux:

   ```bash
   cp .env.example .env.local
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

6. Open `.env.local` and enter the existing Supabase project URL and public publishable key. Never
   use a service-role key in the frontend or commit `.env.local`.
7. Start the development server:

   ```bash
   npm run dev
   ```

8. Open the local URL printed by Vite.
9. Verify a production build:

   ```bash
   npm run build
   ```

## Supabase migrations

The migration files are included in this order:

1. `20260924000100_create_profiles.sql`
2. `20260924000200_create_listings.sql`
3. `20260924000300_create_rental_requests.sql`
4. `20260924000400_add_public_profiles.sql`
5. `20260924000500_add_public_trust_details.sql`
6. `20260924000600_add_rental_completion_and_reviews.sql`
7. `20260924000700_add_request_notifications.sql`
8. `20260924000800_add_listing_moderation.sql`
9. `20260924000900_add_admin_dashboard.sql`
10. `20260924001000_add_admin_rental_oversight.sql`
11. `20260924001100_make_admin_accounts_internal.sql`
12. `20260924001200_add_manual_payment_methods.sql`
13. `20260924001300_add_renter_request_cancellation.sql`
14. `20260924001400_add_verified_rental_payments.sql`

The Supabase database is remote and is not stored in this ZIP. Migrations already applied to the
same Supabase project must not be applied again. Apply only migrations that are still pending, in
filename order, after confirming the current project state in Supabase.

This ZIP does not contain database contents, Supabase Storage contents, or Supabase Auth accounts.
Those remain in the remote Supabase project. It also does not contain local credentials,
`node_modules`, build output, caches, logs, or Git history.
