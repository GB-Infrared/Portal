# ENEROPS OS portal (React)

The portal from the `portal-design-mockup` branch, built in React and connected
to a backend. It has no sample data. Every number on screen comes from the API.

The mockup branch is still the reference for how things look and behave.


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


## Where things are

```
src/api/            everything about the backend
  endpoints.ts        all paths
  adapters.ts         backend JSON -> portal types
  types.ts            the types the screens use
  portal.ts           one function per call
  client.ts           fetch, auth, errors
src/pages/          one file per screen
  Login, SiteControl, Home, Monitoring, Alarms, Analysis, Kpi, Settings
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
  drawing code, converted to a module. Its comments explain the design.
- **npm scripts** call `node` directly. The usual shortcuts break when the folder
  path has an `&` in it (like `Portal & Mobile App`).
