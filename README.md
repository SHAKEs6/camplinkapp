# camplinkapp

Camplink Connect mobile app

Expo / React Native companion app for the Camplink campus marketplace and community. It uses the same Supabase backend as [Camplink Connect on the web](https://camplink-connect.vercel.app/).

## Features

- Email/password and Google sign-in with a persistent native session.
- Campus home, searchable marketplace, housing filters, and community updates.
- Tap listing photos to open a full-screen gallery; listing details open the purchase flow.
- Buy with the Camplink wallet, M-Pesa STK, PesaPal/card, or PayPal.
- Top up the cash wallet, view transaction history, update profile details, and upload a profile photo.
- Admin-only member approval, wallet freeze, listing moderation, and announcement tools.
- Camplink's original logo, favicon, and midnight-indigo/purple/gold appearance.

## Run locally

1. Install Node.js compatible with Expo SDK 57.
2. Copy `.env.example` to `.env` (set the Supabase URL and public anon key for your project).
3. Run `npm ci` and then `npm start`.
4. Scan the QR code with Expo Go, or use `npm run android`. The browser preview is `npm run web`.

## Provider setup

- Google sign-in must be enabled under Supabase Authentication → Providers → Google. Add the `camplink://auth/callback` redirect URI to Supabase Auth's redirect allow list and configure the Google OAuth client IDs/redirect URI in the provider settings.
- Payment providers use the existing Supabase Edge Functions. Configure M-Pesa, PesaPal, and PayPal secrets in Supabase; payment confirmation and wallet crediting happen server-side.
- Apply the migration in `../supabase/migrations/20261009090000_mobile_admin_owner.sql` using the parent repository's Supabase migration workflow to promote `shakesian6@gmail.com` to admin. Other admin controls remain guarded by Supabase role checks.

The local `.env` file is ignored by Git; `.env.example` is the checked-in template. Never commit provider secrets or Supabase service-role keys.
