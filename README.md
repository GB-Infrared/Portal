# ENEROPS OS portal (React)

The portal from the `mockup` branch, built in React and connected
to a backend. It has no sample data. Every number on screen comes from the API.

The mockup branch is still the reference for how things look and behave.

**Status:** all eight screens and the web admin panel are done, and they match
the mockup in light and dark mode. The portal is not yet connected to the real sunhub.in backend. The
API in [docs/API.md](docs/API.md) was designed from the screens, so expect to
change paths and field names when connecting it (see below).


## Run it

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local     # then edit it, see below
npm run dev                    # http://localhost:5173
```

Build for the server:

```bash
npm run build                  # output in dist/
```

`dist/` is a static site. Serve it from any web server, and send every unknown
path back to `index.html` (the portal does its own routing).

Without a backend this is what you see, and it is expected:

- The sign-in screen works, but signing in stops at "connecting" with
  NOT FOUND and a RETRY button, because nothing answers at `/api`.
- A panel whose call fails shows "Could not load ..." and a "Try again" button.
- An account with no sites shows "No sites".

The repo has no sample data on purpose, so nothing on screen can be mistaken
for real readings.


## Connect it to the backend

Edit `.env.local`:

| Setting | Meaning |
|---|---|
| `VITE_API_BASE_URL` | Where the API is. `/api` if it is on the same domain, or a full URL. |
| `VITE_DEV_PROXY_TARGET` | Development only. For example `https://sunhub.in`. Requests to `VITE_API_BASE_URL` are passed to this server, so there are no CORS problems while testing. |
| `VITE_AUTH_MODE` | `bearer` (login returns a token) or `cookie` (login sets a session cookie). |

Everything the portal asks the backend is listed in **[docs/API.md](docs/API.md)**,
with examples.

To point the portal at existing backend routes:

1. `src/api/endpoints.ts`: change the paths.
2. `src/api/adapters.ts`: change the field names, if the backend names them
   differently.

The screens do not need to change.


## Accounts

This app has two panels:

- The customer panel: Site Control, Home, Monitoring, Alarms, Analysis, KPI and
  Settings.
- The web admin panel at `/admin`: the EnerOps team sets customers up there,
  with their plants, loggers and devices.

The web admin panel creates the customer admin, and the customer admin creates
users.

| Account | Lands on | Settings |
|---|---|---|
| Customer admin | Site Control | All ten screens |
| User | Site Control | User Profile and Customer Devices only. Devices are read-only. |
| Super Admin | Web admin panel | All ten, opened as Customer Admin from the account menu |
| Admin | Site Control | All ten |
| Plant Admin | Site Control | All ten, read-only |

The backend says who is signed in with `accountType` (`"admin"` or `"user"`)
and, for the EnerOps team only, `level` (`"super"`, `"admin"` or `"plant"`) on
`/auth/me` and on login. If `accountType` is missing, the portal treats the
person as a user. The backend must still refuse calls a person is not allowed
to make. See "Who sees what" and "Web admin panel" in
[docs/API.md](docs/API.md).

A web admin user's account menu has Web Admin, Customer Admin and Sign out.
In Customer Admin, User Profile is the customer's profile, not theirs.

In both sidebars every section starts closed, except My Profile in the web
admin panel.


## Where things are

```
src/api/            everything about the backend
  endpoints.ts        all paths
  adapters.ts         backend JSON -> portal types
  types.ts            the types the screens use
  portal.ts           one function per call
  client.ts           fetch, auth, errors
src/pages/          one file per screen
  Login, SiteControl, Home, Monitoring, Alarms, Analysis, Kpi, Settings, WebAdmin
  settings/           the Settings screens
  webadmin/           the web admin screens, with one form and one table for all
src/charts/         the charts
src/components/     header, dropdowns, date and month pickers, table footer
src/config/         parameter (tag) list for Monitoring and Analysis
src/styles/pages/   each screen's stylesheet, copied from the mockup
public/textures/    the globe's Earth and sky images
```


## Good to know

- **Styles**: each page's CSS is the mockup's own, with every rule prefixed by the
  page (`.pg-home ...`) so pages cannot affect each other. Colours are CSS
  variables (tokens). Change the token, not the rule.
- **Light/dark**: light is the default. The choice is saved in the browser.
- **Missing data**: if the backend has no value, send `null`. The screens show a
  dash and break chart lines instead of drawing a fake zero.
- **Errors**: if a call fails, that panel shows what failed and a "Try again"
  button. The rest of the page keeps working.
- **Refresh**: Home, Monitoring and Alarms re-read every 5 minutes by default
  (Refresh menu in the header). Analysis and KPI start with refresh off.
- **Site Control globe**: `src/pages/siteControl/engine.js` is the mockup's
  drawing code, converted to a module. For the reasoning behind the design,
  see `plants.html` on the `mockup` branch.
- **Screen sizes**: the layout is made for about 1600 x 900.
  - Bigger screens (1920 x 1080, 2560 x 1440, 4K, projectors) show the same
    layout scaled up with CSS zoom: 1920 -> 1.2x, 2560 -> 1.6x, 3840 -> 2.4x.
    The script in `index.html` sets it. Under 1.1x nothing is scaled.
  - Because of the zoom, code that reads the mouse or a box on screen uses
    `cssRect`, `cssX`, `cssY`, `viewW` and `viewH` from `src/lib/screen.ts`
    instead of `getBoundingClientRect`, `clientX` or `innerWidth`, and `vw`/`vh`
    in CSS are written as `calc(100vh / var(--z,1))`. New code should do the same.
  - Under 1240px wide the header's tabs move into a menu button; under 680px
    (phones) Refresh and light/dark move there too.
- **Type-check** with `npm run typecheck`. Do not run `tsc -b`: it writes a
  `.js` file next to every source file, and Vite then builds those old copies
  instead of the `.tsx`.
- **npm scripts** call `node` directly. The usual shortcuts break when the folder
  path has an `&` in it (like `Portal & Mobile App`).
- **No comments in the code**, on purpose. Explanations live in this file,
  in `docs/API.md`, and in the mockup HTML on the `mockup` branch.
- **Errors ignored on purpose** (for example the browser blocking storage in a
  private window) go through `ignoreErrors()` in `src/lib/ignoreErrors.ts`, so
  an empty `catch {}` never appears.


## Repository

```
GitHub ......... github.com/GB-Infrared/Portal   (was UI-Design, Portal-UI)
this app ....... branch design    (was portal-design)          folder design-backend/
mockups ........ branch mockup    (was portal-design-mockup)   folder design-mockup/
```

When the design changes, change the mockup first, then carry the change over
to this app.
