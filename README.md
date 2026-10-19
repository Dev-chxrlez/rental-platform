# Rental Platform

A React rental marketplace for individuals and small and medium-sized businesses. It includes
Supabase authentication, user-owned profiles, public listings, owner-managed listing images, and
an explainable rental request risk decision.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Install and run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Environment setup

Copy `.env.example` to `.env.local`, then replace the placeholders with the project URL and public
anonymous key from your Supabase project:

```bash
cp .env.example .env.local
```

Use the public Supabase publishable key (called the `anon` key in older projects). Never add a
service-role or secret key to a frontend environment file. Local environment files are ignored by
Git.

## Apply the profile migration

The migration is at `supabase/migrations/20260924000100_create_profiles.sql`. Apply it before testing
registration:

- With the Supabase CLI linked to the intended project: `supabase db push`
- Or copy the complete migration into the Supabase Dashboard SQL Editor and run it once.

It creates `public.profiles`, creates a profile when an Auth user registers, backfills existing Auth
users, enables Row Level Security, and restricts browser updates to editable profile fields. Users
cannot update ownership, verification, admin, or timestamp fields.

After the base profile migration, apply
`supabase/migrations/20260924000400_add_public_profiles.sql`. This adds an optional profile photo and
short introduction, creates the public `profile-images` bucket, and adds the narrowly scoped
`get_public_profile` RPC. The RPC exposes only a derived display name, account type, photo path,
introduction, and member-since date. It never exposes email, private business details, verification
documents, admin status, or other protected fields. Profile rows remain owner-readable and
owner-editable under the original Row Level Security policies.

Profile images are public so they can appear on public rental profiles. Storage writes and deletes
remain restricted to the authenticated user's own ID-prefixed folder. Apply migrations in filename
order; migration `00400` should run after migrations `00100` through `00300`.

Then apply `supabase/migrations/20260924000500_add_public_trust_details.sql`. It adds optional public
city/municipality, province/region, and an Individual occupation/role or SME industry. These are
self-declared profile details, not verification. The interface specifically asks members to provide
only a general area and never a street address or other precise home location. The public-profile
RPC is replaced so it returns these fields without exposing email, contact details, private business
details, verification state, or admin fields.

## Configure Supabase Auth

In **Supabase Dashboard → Authentication**:

1. Keep email/password sign-ups enabled.
2. Decide whether **Confirm email** is required. The app supports both immediate sessions and the
   confirmation-email flow.
3. Set the Site URL to the deployed frontend URL, or `http://localhost:5173` for local use.
4. Add `http://localhost:5173/reset-password` to the allowed Redirect URLs for local password
   recovery. After deployment, also add `https://YOUR-VERCEL-DOMAIN/reset-password`.
4. Add local and deployed profile URLs to Redirect URLs, for example
   `http://localhost:5173/profile` and `https://your-domain.example/profile`.

Registration only permits `individual` and `sme` account types. Admin and verification state are
not exposed by the frontend and are protected by database column privileges.

## Apply the listings and Storage migration

After the profile migration, apply
`supabase/migrations/20260924000200_create_listings.sql` using `supabase db push` or the Supabase SQL
Editor. Migrations must be applied in filename order.

This migration:

- Creates `public.listings` with database validation for every listing field.
- Uses `auth.uid()` as the owner default; the frontend never submits an owner ID.
- Allows anyone to read active listings while owners can read, create, edit, and delete their own.
- Creates a public `listing-images` Storage bucket with a 5 MB limit and JPG, PNG, and WebP MIME
  restrictions.
- Restricts Storage writes and deletes to the authenticated user's own ID-prefixed folder.

The bucket is created by the migration, so it does not need to be created manually. If the SQL
Editor reports that the `storage` schema or bucket administration is unavailable, run the migration
with a project-owner connection or the Supabase CLI. Do not weaken the Storage policies to work
around a permissions error.

For a policy check, use two confirmed test accounts: create a listing as account A, verify account B
can see the active listing but cannot update/delete its row or replace/delete its image, and verify
account A can edit and remove both. Test policy enforcement through the public publishable key, not
through the service-role key or Dashboard table editor.

## Apply the rental request migration

After the profile and listings migrations, apply
`supabase/migrations/20260924000300_create_rental_requests.sql`. Migrations must be applied in
filename order. Use `supabase db push`, or paste the complete migration into the Supabase SQL Editor
and run it once.

The migration creates `public.rental_requests` and two authenticated RPC functions. Browser clients
cannot insert or update request rows directly. `create_rental_request` derives the renter, owner,
listing price, replacement value, and profile trust fields in PostgreSQL. `decide_rental_request`
allows only the listing owner to accept or reject a pending request. Row Level Security limits reads
to the renter and owner, and an exclusion constraint prevents accepted date ranges from overlapping
for the same listing.

Risk rule `rental-risk-v1` adds points for an unverified account, higher replacement value, and a
longer rental duration. Limited rental history is stored as a neutral factor with zero points; it is
not treated as evidence that the renter is unreliable. Medium-risk requests require a deposit equal
to 10% of replacement value, and high-risk requests require 20%. The app records and displays the
required amount only; it does not collect payment.

To demonstrate the flow, use two confirmed accounts:

1. Sign in as account A, complete its profile, and create an active listing.
2. Sign out, sign in as account B, open A's listing, choose **Request rental dates**, and submit valid
   dates.
3. On **Requests**, confirm B sees the pending status, factors, explanation, and safeguards.
4. Sign in as A, open **Requests**, review B's limited trust snapshot, and accept or reject it.
5. Sign in as B again and confirm the updated status.
6. Create another pending request with overlapping dates and confirm A cannot accept both. A third
   unrelated account must not be able to read or decide either request.

## Apply the rental completion and reviews migration

After migrations `00100` through `00500`, apply
`supabase/migrations/20260924000600_add_rental_completion_and_reviews.sql`. Keep the filename order
when using `supabase db push`; in the SQL Editor, run the complete file once.

This migration adds three database-controlled steps: the owner confirms handover, the renter records
the return, and the owner confirms receipt to complete the rental. Each participant can then submit
one immutable review in their role, with a 1–5 rating and an optional comment up to 1,000 characters.
The database derives reviewer and recipient identities, rejects ineligible or duplicate reviews, and
keeps request rows and private profile fields out of the public reputation RPCs. On-time returns are
calculated only from a recorded return timestamp and the rental end date.

To demonstrate the completed flow with owner account A and renter account B:

1. Accept B's request as A, then choose **Confirm handover**.
2. Sign in as B and choose **Mark item returned**.
3. Sign in as A and choose **Confirm receipt & complete**, then review B.
4. Sign in as B and review A.
5. Open both public profiles and confirm the correct role-specific counts, rating, and real comments.
6. Try reviewing the same rental again and confirm the database rejects it.

## Apply the request notifications migration

After migration `00600`, apply
`supabase/migrations/20260924000700_add_request_notifications.sql`. It creates owner-only notification
rows for new rental requests and renter-only notification rows when a request is accepted or
rejected. Row Level Security allows users to read and mark only their own notifications as read;
browser clients cannot create notifications or change their ownership or event details.

The navigation bell loads the latest 20 real notifications and refreshes periodically while the app
is open. To verify it, submit a request as renter account B and confirm owner account A receives an
unread notification. Accept or reject it as A, then confirm B receives the matching decision
notification. Opening the notification links to **Requests** and marks that notification as read.

After migration `00700`, apply
`supabase/migrations/20260924000800_add_listing_moderation.sql`. New and edited listings remain
pending until an administrator approves them. Only approved, active listings are publicly visible,
and rejected listings include a note telling the owner what to change.

To designate the first administrator, use the Supabase SQL Editor while signed in as the project
owner. Replace the email below with the intended administrator's confirmed Auth email:

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'admin@example.com');
```

Do not expose `is_admin` through profile forms or grant browser clients permission to update it.

After migration `00800`, apply
`supabase/migrations/20260924000900_add_admin_dashboard.sql`. This adds an admin-only dashboard RPC
that returns operational counts and recent listing submissions without exposing administrative data
to regular accounts. Administrators are sent to `/admin` after signing in.

After migration `00900`, apply
`supabase/migrations/20260924001000_add_admin_rental_oversight.sql`. Administrators can then inspect
platform-wide rental request totals and details from `/admin/requests`. Administrator accounts are
blocked at the database level from submitting rental requests themselves.

After migration `01000`, apply
`supabase/migrations/20260924001100_make_admin_accounts_internal.sql`. Administrator accounts are
excluded from public profiles and blocked from creating marketplace listings. Admin navigation also
omits member profile and account-setting pages.

After migration `01100`, apply
`supabase/migrations/20260924001200_add_manual_payment_methods.sql`. Owners can then save GCash or
bank-transfer instructions with an optional QR image. The QR bucket is private, and only the owner
and a renter with an active accepted rental can read the payment details. The platform does not
process or verify payments.

After migration `01200`, apply
`supabase/migrations/20260924001300_add_renter_request_cancellation.sql`. A renter can then cancel
their own request while it is still pending. Accepted or later-stage rentals cannot be cancelled,
and the listing owner receives a cancellation notification.

After migration `01300`, apply
`supabase/migrations/20260924001400_add_verified_rental_payments.sql`. Required deposits must be
submitted with a receipt before owner acceptance. After handover, renters can record payment by
Cash, GCash, or bank transfer, and the owner must confirm it before completing the rental.

## Production build

```bash
npm run build
```

The static output is written to `dist/`. To inspect it locally, run `npm run preview` after building.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Keep the detected Vite settings (`npm run build` and `dist`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment settings.
4. Deploy.

`vercel.json` rewrites browser requests to `index.html` so direct visits to React Router routes work.
