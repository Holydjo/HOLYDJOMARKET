# HOLYDO MARKET

HOLYDO MARKET is a web and mobile platform that connects local small businesses and independent service providers with nearby customers. Customers search for services such as hair, braids, beauty, cleaning and repairs by location, compare provider profiles and request appointments. Providers create a free profile with their services, prices, photos, opening hours and travel area. Each profile is published only after an administrator approves it.

The interface is in French. Labels shared across screens live in `frontend/src/lib/labels.ts`; page-specific text is still written in each page.

## Stack

| Part | Technology |
| --- | --- |
| API | NestJS 11, Prisma 5, PostgreSQL, JWT auth (passport-jwt, bcrypt), Multer uploads |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS 4, Leaflet + OpenStreetMap |
| Mobile | Responsive, phone-first website installable as a PWA (`public/manifest.webmanifest`) |

## Run it locally

Requirements: Node 20+ and a running PostgreSQL.

```bash
# 1. API — http://localhost:4001
cd backend
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npm install
npm run db:push               # create tables from prisma/schema.prisma
npm run db:seed               # demo data (wipes the database first)
npm run start:dev

# 2. Web — http://localhost:4000
cd ../frontend
echo 'NEXT_PUBLIC_API_URL=http://localhost:4001' > .env.local
npm install
npm run dev
```

### Demo accounts (created by `npm run db:seed`)

Every demo account uses the password defined as `DEMO_PASSWORD` in `backend/prisma/seed.ts`.

| Role | Email |
| --- | --- |
| Admin | `admin@holydo.test` |
| Customer | `client@holydo.test` |
| Provider (approved, has a pending request) | `awa@holydo.test` |
| Provider (pending review) | `ruth@holydo.test` |
| Provider (rejected, must fix) | `dan@holydo.test` |

## User journeys

**Customer**
1. Home (`/`): choose a service and a neighbourhood, or tap "Autour de moi" to use the device location.
2. Results (`/recherche`): providers sorted by distance, with filters (where the service happens, independent or business, maximum price, radius, sort order) and a map. On phones a button switches between the list and the map.
3. Provider profile (`/p/<slug>`): photos, description, services and prices, where the service happens and travel area, opening hours with an "open now" badge, and reviews. Customers can also call or message the provider on WhatsApp.
4. Appointment request: a form in a bottom sheet on phones and a sticky side panel on desktop. Visitors who aren't logged in create an account and come back to the same page.
5. My requests (`/compte`): track the status of each request, cancel one, and leave a review once the provider has accepted.

**Provider**
1. `/devenir-pro` explains the process, then `/inscription?role=pro` creates the account.
2. `/dashboard` starts with onboarding: identity (independent or business), contact details, neighbourhood or GPS location, and where the service happens (at the provider's home, in a salon, in a shop, or travelling to the client within a set radius).
3. The provider adds services, photos and opening hours. A checklist shows what's missing, and **Soumettre pour validation** only unlocks when the required items are done.
4. Once approved, the profile is public. The provider answers appointment requests (accept or decline, with a note) and edits everything from the dashboard. Changing the profile's **name or type** sends it back for review.

**Admin**
- `/admin` shows counters and queues by status (pending, published, to fix, draft).
- Each card has what's needed to decide: photos, description, services, location, and account contact details.
- The admin can **approve**, or **reject or suspend** with a message the provider sees on their dashboard.
- Every decision is recorded in `ModerationLog`.

## Code map

```
backend/
  prisma/schema.prisma     data model (one comment block per model)
  prisma/seed.ts           demo data
  src/common/              auth guards & decorators, geo helpers, known places
  src/auth/                register / login / me
  src/categories/          GET /categories, GET /places
  src/providers/           public search + profile, provider dashboard API (/me/profile)
  src/appointments/        booking requests
  src/reviews/             ratings (only after an accepted appointment)
  src/admin/               moderation queue
frontend/src/
  app/                     one folder per page (see journeys above)
  components/              shared UI, search bar, cards, map, dashboard editors
  lib/                     API client, types, shared labels, data hooks
```

## Key rules (enforced by the API, not just the UI)

- Only `APPROVED` profiles appear in search and can receive bookings. Other profiles are visible only to their owner and to admins.
- Self-service sign-up can only create customers or providers; admin accounts come from the seed or the database.
- To submit a profile for review it needs a description of 30+ characters, at least one place where the service happens, at least one active service and at least one photo.
- A customer can review a provider only after that provider accepted one of their requests. There is one review per customer per provider.
- A provider sees a customer's email and phone number only after accepting their request.
- Prices are stored in cents. Distances use a bounding-box query followed by an exact haversine calculation (see `src/common/geo.ts`).

## Not in V1 (planned)

Online payment, real-time chat, email and SMS notifications, native iOS and Android apps (they would use the same API), cloud photo storage (S3 or Cloudinary instead of `backend/uploads/`), a full English translation, a geocoding API to replace the built-in neighbourhood list (`src/common/places.ts`), and PostGIS once the number of providers grows.
