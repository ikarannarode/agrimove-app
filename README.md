# Smart Krushi Malvahatuk Vyavasthapan Pranali

This Marathi-first Android/iOS application connects farmers with vehicle owners and drivers. It retains the Phase 1 booking/trip flow and adds Phase 2 map-based pickup/drop-off selection and manual cash or QR/UPI payment verification.

The mobile app supports only the **Farmer** and **Vehicle Owner / Driver** roles. It has no public admin registration; the administrator dashboard is a separate web application. Maps are used only to select and view pickup/destination coordinates; live GPS, moving vehicle markers, route tracking, and driver navigation are not implemented.

Phase 3 adds a separate React web app under `admin/` for administrator-only system monitoring. It uses the same Supabase project and the existing `profiles`, `vehicles`, `bookings`, `trips`, and `notifications` tables; it does not create a second backend or database.

## Technology

- React Native 0.86.3, Expo SDK 57, and TypeScript
- Expo Router with role-protected bottom-tab navigation
- Supabase Auth and PostgreSQL with row-level security
- AsyncStorage-backed native session persistence
- MapLibre React Native 11.5.0 with configurable map style
- Expo Location for optional current-location centering (manual map selection works without granting permission)
- Private Supabase Storage buckets for owner QR images and payment screenshots
- Supabase Edge Function + pg_cron/pg_net for backend screenshot cleanup

## Requirements and installation

- Node.js 18 or later and npm
- A Supabase project
- Android Studio/emulator for Android native development
- macOS and Xcode for iOS native builds

```sh
npm install
```

## Environment

Copy `.env.example` to `.env`, set the mobile client values, and restart Expo:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
EXPO_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
EXPO_PUBLIC_MAP_ATTRIBUTION=© OpenStreetMap contributors · OpenFreeMap
```

Get the project URL and anon/publishable key from **Supabase Dashboard → Project Settings → API**. Configure a compatible MapLibre style URL and its required attribution when replacing the map provider. OpenFreeMap is a starting provider, not an uptime or unlimited-use guarantee; configure a provider and usage terms appropriate for production. The standard OpenStreetMap tile servers must not be treated as an unlimited production tile API.

Only public client values belong in the mobile app. Never expose a service-role key, database password, JWT secret, screenshot cleanup secret, or private API key through an `EXPO_PUBLIC_` variable.

For a local Supabase project, configure a URL reachable from the device. Android emulators commonly reach a host service at `10.0.2.2`; physical devices need the development computer's LAN address.

## Database setup

Run these SQL files in the Supabase SQL editor, in order:

1. `database/schema.sql` — creates the existing database foundations. It does not seed sample production data.
2. `database/transport-schema.sql` — adds profiles, vehicles, journeys/bookings, notifications, and role/ownership policies.
3. `database/phase1-mobile.sql` — adds vehicle driver and availability fields, direct vehicle bookings, trip statuses, notifications, and Phase 1 policies/triggers. This migration is additive and preserves existing records.
4. `database/phase2-mobile.sql` — adds booking coordinates, owner payment settings, private storage buckets/policies, separate payment states, payment notifications, and screenshot retention metadata. It is additive; it does not delete or backfill existing bookings.

Enable email/password sign-in in Supabase Auth. Registration in the app creates only farmer and vehicle-owner accounts; the database auth trigger creates the matching profile. Configure email confirmation in Supabase according to your deployment requirements.

The Phase 1 and Phase 2 migrations use the `agri_private` schema for RLS helper functions; leave that schema out of Supabase's exposed API schemas. Do not disable RLS. The setup scripts do not drop tables, seed sample data, or run data backfills. Existing vehicles without driver details are omitted from farmer search until their owner edits the vehicle and enters driver information.

### Screenshot retention worker

Payment QR and proof buckets are private. The app stores object paths, never base64 or permanent public URLs; access uses short-lived signed URLs. After an online payment is approved, the database records its approval timestamp and schedules screenshot deletion. Rejected proof remains available for the farmer to replace and the owner to review until approval. The default post-approval retention is 24 hours.

Deploy the backend function (never into the mobile bundle) and set matching backend-only secrets:

```sh
supabase functions deploy delete-expired-payment-screenshots
supabase secrets set PAYMENT_SCREENSHOT_RETENTION_HOURS=24 PAYMENT_SCREENSHOT_CLEANUP_SECRET=replace-with-a-strong-random-secret
```

The hosted Edge Function supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; do not copy either secret into the app. In the Supabase SQL editor, store the project URL under `phase2_project_url` and the same cleanup secret under `phase2_cleanup_secret` using Vault:

```sql
select vault.create_secret('https://your-project-ref.supabase.co', 'phase2_project_url');
select vault.create_secret('replace-with-the-same-random-secret', 'phase2_cleanup_secret');
```

Then run `database/phase2-screenshot-cleanup-schedule.sql` to invoke the backend worker every 15 minutes. The migration stores the default retention in `payment_screenshot_policy`; if changing the retention hours, update that database value and the Edge Function secret to the same integer. Until the function is deployed and the Vault/cron schedule configured, screenshot deletion is **not** active.

## Run the mobile app

```sh
npm start
```

MapLibre includes native code and does not run in Expo Go. Expo SDK 57 uses React Native's New Architecture; build a custom development client after adding the dependency/config plugin:

```sh
npx expo run:android
# or, on macOS with Xcode:
npx expo run:ios
```

Use the resulting development build; a JS reload alone cannot add the native MapLibre module.

### Android

```sh
npm run android
# or for a native development build:
npx expo run:android
```

### iOS

On macOS with Xcode:

```sh
npm run ios
# or for a native development build:
npx expo run:ios
```

Windows does not support local iOS native compilation. Use a Mac/Xcode for iOS builds.

## Phase 1 flows

- **Farmer:** Register/login → search available vehicles by type/capacity → view vehicle/driver details → submit a booking → see pending/accepted/rejected status and trip progress → notifications/profile.
- **Vehicle owner / driver:** Register/login → add/edit vehicles and availability → receive booking notifications → accept/reject requests → view trips and set reserved trips in-progress/completed → notifications/profile.

Booking acceptance, vehicle reservation, trip creation, trip status transitions, and in-app notifications are enforced by database triggers and row-level security as well as the mobile UI.

## Phase 2 flows

- **Maps:** Choose pickup and destination by tapping the map. Coordinates and readable location text are saved on the booking. Current location is an optional starting point; declining location permission still allows manual selection. There is no geocoding or tracking. Map attribution is shown.
- **Cash:** Owner accepts the request → trip completes → owner records cash as received. No screenshot is requested.
- **Online:** Farmer may choose online only if the owner has a QR → owner accepts → farmer pays outside the app and uploads a screenshot with optional UTR → owner approves/rejects. Payment status is separate from booking status; owners can also set an optional UPI ID.
- **Privacy:** Payment proof uploads are private and owner/farmer-only. The server-side cleanup function removes the image after the configured retention while preserving status, UTR, approval, scheduled deletion, and actual deletion timestamps.

No payment gateway or amount calculation is provided. `payment_amount` remains null until the application has an agreed price/rate source.

### Manual Phase 2 smoke test

Use separate confirmed farmer and vehicle-owner accounts on a configured Supabase project and a native development build. Apply all four migrations in order, configure storage and backend cleanup as above, then:

1. Owner saves a QR image and optional UPI ID in Profile → Payment Settings.
2. Farmer selects an available vehicle, chooses both pickup/drop-off points on the map, and submits an online booking.
3. Owner accepts; farmer sees the owner QR/UPI and receives the QR notification.
4. Farmer selects a screenshot, optionally enters UTR, and submits; owner reviews the private signed image and approves/rejects.
5. Verify the booking payment status, notifications, `payment_delete_at`, and that the cleanup function removes the object and clears its path after expiry.
6. Create a separate cash booking, accept it, complete the trip, and have the owner record cash payment.
7. Repeat cross-user reads/writes with the two test accounts to verify RLS. Do not disable RLS.

## Validation

```sh
npx tsc --noEmit
npx expo install --check
npm run lint
npx expo export --platform android --output-dir .\dist-android-check
npx expo export --platform ios --output-dir .\dist-ios-check
```

End-to-end authentication and booking testing requires a configured Supabase project and separate test accounts for each mobile role.

## Admin web application

The Admin dashboard is a separate Vite/React/TypeScript application. It uses Supabase Auth and the existing database with the anon key; the service-role key is never included in frontend code. Payments are displayed from the payment columns on `bookings` because the schema does not have a separate payments table. There is no public admin registration route. Admin authorization is enforced by checking the profile role and by existing database RLS policies.

Apply the existing SQL files in their documented order. No Phase 3 schema migration is needed: the `admin` role, admin RLS helper, and admin read access for profiles, vehicles, bookings, trips, and notifications are already defined. Do not disable RLS. To provision the initial administrator, create/confirm a user through the trusted Supabase Auth process, then promote that known profile from the Supabase SQL editor using the user UUID:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'REPLACE_WITH_THE_TRUSTED_AUTH_USER_UUID';
```

This is an operator-only action. Never expose the service-role key or allow users to self-select the admin role. The auth profile trigger intentionally creates only farmer/vehicle-owner roles from public sign-ups.

Configure the Admin app in `admin/.env` (copy `admin/.env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Run locally and build for static hosting:

```sh
cd admin
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

Configure those same public Vite variables in the hosting provider's build environment. `admin/public/_redirects` and `admin/vercel.json` provide SPA fallback routing for Netlify and Vercel. Add the deployed Admin origin to Supabase Auth's allowed redirect/site URL configuration as appropriate. The dashboard only views records; it does not approve payments, alter trips/bookings, or retrieve payment screenshots. Screenshot objects remain private under the existing farmer/owner Storage policies; when a screenshot has been removed, booking details show the privacy notice.

Email and account activation status are not fields in the existing public profile schema, so they are not exposed by this dashboard. A separate payments table, admin storage access, or additional migration would unnecessarily expand the existing data/security model.

### Production build readiness

The production Android application ID and iOS bundle identifier are both configured as `com.smartkrushi.malvahatuk` in `app.json`. Confirm that this namespace is controlled by the publisher before the first store release; changing it later creates a different store app. App icons, splash screen, name, and version are configured. EAS profiles are in `eas.json`; after linking the app with `eas init`, create a production build with `npx eas-cli build --platform android --profile production` (or `--platform ios`). For a local Android release, use `npx expo run:android --variant release`. iOS local native builds require macOS/Xcode. These commands build only; they do not publish automatically.

The screenshot cleanup worker is deployed and scheduled separately from the dashboard. Verify the Edge Function deployment, backend-only retention secret, Vault values, and `phase2-screenshot-cleanup-schedule.sql` in the target Supabase project. The dashboard does not report the cron job as active because its status is not safely exposed to an anon-key client. Configure the project's Auth URL allow-list and any required CORS at the hosted backend/service; Supabase client requests in the browser go directly to the configured project URL.

Admin role verification, all dashboard queries, booking/payment/trip content, and Storage access require a configured Supabase project and a provisioned admin test account. Static builds do not substitute for those live authorization checks.
