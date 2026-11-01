# Frontend foundation — Phases 0 and 1

The audit found working auth, identity management and merchant onboarding screens,
with protected routes, a shared AuthContext and separate Auth/Merchant Axios clients.
Legacy customer/merchant/courier/admin dashboard components remain on disk; active
routes intentionally show unavailable operations until their services exist.
Public tracking is also a placeholder. No business APIs were added in this phase.

The previous single navbar crowded authenticated links into one row. There was no
sidebar or mobile drawer, several local button/input styles were duplicated, and
admin tables depended on horizontal scrolling. Existing branding, StatusBadge,
AuthContext, route guards, live forms and API clients were reused. Legacy dashboards
are retained rather than merged into the working routes.

`src/layouts/SharedLayouts.jsx` provides PublicLayout, AuthLayout and named customer,
merchant, courier, dispatcher and admin boundaries over one PortalLayout. Navigation
comes from the verified context role. ADMIN-only links remain hidden from dispatcher.
The navbar compatibility export remains available. Sidebar links show an active
state, breadcrumbs describe the current route, and a skip link reaches main content.

Desktop (1024px+) uses a fixed navy sidebar and top bar. Smaller widths use a drawer
with Escape, focus trapping/restoration and background inertness. Mobile admin
tables become labeled records with wrapping actions. Forms use a single column
below 640px and existing grid columns above it. Controls target 44px touch heights.
Long content wraps; reduced-motion preferences and visible keyboard focus apply.

`src/components/ui/index.jsx` exports Button, Input, Select, Textarea, Modal,
ConfirmDialog, PageHeader, StatCard, DataTable, SearchFilterBar, Pagination,
EmptyState, ErrorState, LoadingSkeleton and Toast. Existing StatusBadge now includes
application and account states without removing parcel statuses. Merchant pages and
admin tables adopt the shared foundation; auth behavior stays in existing components.
Use controlled fields and pass backend validation text via `error`. DataTable columns
provide keys, labels and optional render functions; real rows remain caller-owned.
StatCard and ConfirmDialog are available for later phases without adding fake metrics
or replacing the existing inline approval confirmation flow.

Tokens live in Tailwind and `src/index.css`: blue primary actions, slate/navy
navigation, light surfaces, slate borders, rounded cards and restrained shadows.
Use PageHeader for page headings, `ui-card` for surfaces and shared controls for
future screens. Keep forms accessible using labels, hints and error associations.

Verify with `npm test` and `npm run build`. The isolated responsive suite is
`node e2e/design-foundation.cjs`; set `SWIFTDROP_PLAYWRIGHT_PATH` if Playwright is
installed outside frontend and optionally `FRONTEND_BROWSER_URL`. It uses Edge,
intercepts APIs only inside its test browser, checks all five roles plus public/auth
screens at 360, 390, 430, 768, 1024, 1280 and 1536px, and saves screenshots under
ignored `node_modules/.cache/swiftdrop-phase2`. It never creates live accounts.
The existing real-HTTP onboarding browser suite remains a separate regression check.

Verified results: 54 frontend tests and the production build pass. Edge checks cover
130 document/body overflow assertions at the seven widths above. Separate real-HTTP
browser suites pass eight role/session/identity scenario groups and seven password
recovery/onboarding groups against isolated H2 services. No backend source, Neon
configuration, authentication state management or API contracts changed. Live Google
consent and SMTP delivery are outside these checks. Business dashboards remain
placeholders; this foundation does not supply parcel/courier/dispatch operations.

Business dashboards and delivery operations remain outside this foundation.

# Phase 2 — public website and authentication UI

The home page now introduces the available services without invented rates,
testimonials, statistics or delivery guarantees. Public navigation and the responsive
footer link to `/`, `/track`, `/pricing`, `/help` and `/contact`. Authenticated users
receive a dashboard link based on their verified role.

Tracking uses the existing `/track` and `/track/:trackingNumber` routes. It validates
references, handles pending/unavailable/not-found/network states, and offers a
clearly labeled fictional demonstration. Public results render only tracking status,
city-level route details, supplied dates and public events. Names, street addresses,
phone numbers, courier identities and internal notes are never rendered there.

`src/api/publicServices.js` is the future integration boundary for tracking, pricing
and contact. All three default adapters reject as unavailable and perform no HTTP
requests. No business endpoint, price formula or support address is assumed. Future
tracking data must supply the explicit public projection used by PublicTrackingResult;
quotes require a numeric `amount` and `currency: 'LKR'`; contact success requires an
explicit `accepted: true` receipt. Implement and test actual public contracts before
replacing these adapters. The contact form never claims unavailable messages were sent.

Help contains searchable, expandable answers across seven categories. Pricing and
contact include validated forms and explicit service availability messages.
AuthPanel and PasswordInput reuse the shared foundation. Login, registration,
recovery, activation and Google callback pages retain their existing handlers and
contracts. Registration confirmation stays in browser state and is not submitted.
Account settings display read-only verified details, Google connection status and automatic-link guidance,
password recovery and logout; profile editing is not implemented.

The expanded browser suite checks every new page at all seven required widths,
including tracking demonstration timelines, public/mobile navigation, validation
messages, auth processing and account settings. It also captures Google authorization
start without signing into Google. Existing real-HTTP suites use isolated H2 services
and fake mail. SMTP settings, Neon, JWT/session code and backend source remain unchanged.

Phase 2 verification: 77 frontend tests and the production build pass. Edge passed
270 overflow checks at 360, 390, 430, 768, 1024, 1280 and 1536px, including logged-in
public headers/drawers for all roles. The Google challenge/start check passed.
Both existing real-HTTP suites passed all 15 scenario groups, covering registration,
all five role logins, restoration/logout, activation, account administration,
fake-mail password reset and merchant approval/rejection/resubmission. Home and login
screenshots were also inspected. No real accounts or live email sends were used.
Personal Google consent and real SMTP delivery were not rerun in this UI phase.

# Google account linking update

Account settings now show provider status and automatic-link guidance only. The
Connect Google/password reauthentication form and `/auth/google/link` action are
removed. The login button and browser verifier/callback flow are unchanged. Google
activation failures receive a specific safe message on the login page. Account roles,
profile details, password recovery and logout keep their existing contracts. See the
README for the activation eligibility policy and automatic credential/session behavior.
