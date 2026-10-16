# Portal API

This is the list of calls the portal makes to the backend. Each one says what the
portal sends and what it expects back.

The portal does not need the backend to use these exact paths or field names.
If the existing sunhub.in backend already has a route for the same data, point
the portal at it instead:

- Paths are all in `src/api/endpoints.ts`. Change the path there.
- Field names are mapped in `src/api/adapters.ts`. If the backend calls a field
  `power_kw` instead of `powerKw`, change it there.

Nothing in the screens needs to change for either.


## General rules

- All requests and responses are JSON.
- Paths below are relative to `VITE_API_BASE_URL` (default `/api`).
- Times are ISO 8601 with an offset, for example `2026-07-27T12:10:03+05:30`.
- Dates are `YYYY-MM-DD`. Months are `1`–`12`.
- **A value that was not measured must be `null`, not `0`.** The screens print
  `null` as a dash. A `0` is shown as a real zero reading.
- Errors: send a normal HTTP error status and, if possible, a body like
  `{ "message": "Operator or passkey not recognised" }`. The message is shown to
  the user.
- `401` on any call (except sign-in) sends the user back to the sign-in screen.


## Sign-in

Set `VITE_AUTH_MODE` to match the backend:

- `bearer`: login returns a token. The portal sends it on every call as
  `Authorization: Bearer <token>`.
- `cookie`: login sets a session cookie. The portal sends requests with
  credentials and ignores the token.

| Call | Sends | Returns |
|---|---|---|
| `POST /auth/login` | `{ email, password }` | `{ token, user: { id, name, email, role, accountType } }` |
| `POST /auth/logout` | – | anything |
| `GET /auth/me` | – | `{ id, name, email, role, accountType }` (the signed-in user) |
| `POST /auth/password-reset` | `{ email, newPassword }` | anything |

Notes:

- Wrong email or password should return `401` or `403`. The sign-in screen shows
  REFUSED and takes the user back to the form.
- `GET /auth/me` is called when the portal opens, to check the saved session is
  still valid.
- `accountType` is `"admin"` for the customer admin (the account the web admin
  panel creates) and `"user"` for a user the customer admin creates. Anything
  else, or a missing value, is treated as `"user"`. The portal never shows admin
  screens by mistake. See "Who sees what" under Settings.
- Password reset: the portal only sends the request. The backend should confirm
  it (emailed link or code) before the new password works. The screen tells the
  user to check their email.


## Sites

### `GET /sites`

All sites this user can see. Used by Site Control, the header and every page.

```json
[
  {
    "id": "SANGRIA-01",
    "name": "Sangria",
    "address": "2 DLP, Kikarwali Road, Nathwana",
    "lat": 29.80,
    "lng": 74.47,
    "acCapacityKw": 2500,
    "dcCapacityKw": 2500,
    "deviceCount": 9,
    "downCount": 5,
    "warnCount": 1,
    "critCount": 0,
    "powerKw": 514.7,
    "energyTodayKwh": 1819.2,
    "peakKwToday": 606.3,
    "state": "warn",
    "updatedAt": "2026-07-27T12:10:03+05:30"
  }
]
```

- `state` is one of `ok`, `warn`, `crit`, `off`. If left out, the portal works it
  out from the counts.
- A site without `lat`/`lng` still appears in the portal, but not on the globe.

### `GET /portfolio/today`

Totals for the Site Control strip.

```json
{
  "revenue": 96500,
  "currency": "₹",
  "co2AvoidedKg": 24000,
  "times": ["2026-07-27T06:00:00+05:30", "2026-07-27T06:10:00+05:30"],
  "kw":    [0, 41.5]
}
```

`times` and `kw` are the whole portfolio's power so far today, summed over all
sites.


## Home

### `GET /sites/{siteId}/summary`

The 8 cards at the top of Home. Each reading has its own `updatedAt`, shown under
the card as "last updated".

```json
{
  "capacityKw": 2500,
  "plantPowerKw":        { "value": 520.1,     "updatedAt": "2026-07-27T12:10:03+05:30" },
  "peakPowerKw":         { "value": 606.3,     "at":        "2026-07-27T10:29:00+05:30" },
  "energyTodayKwh":      { "value": 1845.01,   "updatedAt": "..." },
  "energyYesterdaySameTimeKwh": 1992.6,
  "plantEnergyKwh":      { "value": 103003.91, "updatedAt": "..." },
  "performanceRatioPct": { "value": 23.4,      "updatedAt": "..." },
  "irradianceWm2":       { "value": 888,       "updatedAt": "..." },
  "revenue":             { "value": 292531.11, "updatedAt": "..." },
  "currency": "₹",
  "co2AvoidedKg":        { "value": 73132.78,  "updatedAt": "..." }
}
```

`energyYesterdaySameTimeKwh` is yesterday's energy up to the same time of day.
It drives the "vs yesterday" percentage.

If the plant uses meter (MFM) data instead of inverter data for these figures,
that choice is made on the backend. The portal just shows what this call returns.

### `GET /sites/{siteId}/devices`

All devices of the site. Used by Home, Monitoring, Analysis and Settings.

```json
[
  {
    "id": "31076873",
    "name": "INV01",
    "kind": "INV",
    "status": "ok",
    "powerKw": 245.3,
    "energyTodayKwh": 922.5,
    "energyTotalKwh": 62359.4,
    "ratedKw": 350,
    "model": "HVERTER SI-350K-NO",
    "commissionedOn": "2021-03-12",
    "retired": false,
    "lastSeenAt": "2026-07-27T12:10:03+05:30"
  }
]
```

- `kind`: `INV` inverter, `MFM` meter, `WMS` weather station, `TRF` transformer.
- `status`: `ok`, `warn` (low output), `down` (offline).
- `id` must never change. `name` can be renamed in Settings.

### `GET /sites/{siteId}/power?date=YYYY-MM-DD`

The Plant Power vs Irradiance chart. One time axis, the plant total, irradiance,
and each inverter.

```json
{
  "date": "2026-07-27",
  "times": ["2026-07-27T06:00:00+05:30", "2026-07-27T06:05:00+05:30"],
  "plantKw": [0, 12.4],
  "irradianceWm2": [3, 41],
  "devices": [
    { "id": "INV01", "kw": [0, 1.9] }
  ]
}
```

Use `null` for a missing reading. The chart line breaks there instead of drawing
across the gap.

### `GET /sites/{siteId}/energy/daily?year=2026&month=7`

Plant Energy Generation chart: one value per day.

```json
{ "year": 2026, "month": 7, "days": [ { "day": 1, "kwh": 11820.5 }, { "day": 28, "kwh": null } ] }
```

### `GET /sites/{siteId}/kpi/daily?metric=CUF&year=2026&month=7`

Plant KPI chart on Home. `metric` is `CUF`, `PR` or `Availability`.

```json
{ "year": 2026, "month": 7, "days": [ { "day": 1, "actual": 19.1, "simulated": 19.6 } ] }
```

### `GET /sites/{siteId}/alarms`

Used by Home (open alarms) and the Alarms page (full log).

| Query | Meaning |
|---|---|
| `status=active` | only alarms that are still open (Home) |
| `from`, `to` | ISO times. Alarms received in this window (Alarms page) |

```json
[
  {
    "id": "ALM-2003",
    "receivedAt": "2026-07-27T23:57:43+05:30",
    "resolvedAt": null,
    "status": "active",
    "text": "Grid Reconnected",
    "severity": "event",
    "deviceId": "31076873",
    "deviceName": "INV06",
    "category": "inverter"
  }
]
```

- `severity`: `critical`, `alarm`, `warn` (or `warning`), `event`.
- The Alarms page filters by device, severity and status in the browser, so
  return the whole window. If windows get very large, tell us and we will move the
  filters to the server.


## Monitoring and Analysis

### `GET /sites/{siteId}/devices/{deviceId}/live`

The device panel on Monitoring (hover a device).

```json
{
  "deviceId": "31076873",
  "status": "ok",
  "model": "HVERTER SI-350K-NO",
  "ratedKw": 350,
  "updatedAt": "2026-07-27T12:10:03+05:30",
  "values": { "P_AC": 198.64, "S_AC": 199.04, "Q_AC": 0.6, "F_AC": 49.88, "COS_PHI": 0.999,
              "I_AC1": 139.1, "I_AC2": 138.5, "I_AC3": 139.4 }
}
```

### `GET /sites/{siteId}/timeseries`

Any parameter for any devices over a time window. Used for the Monitoring chart
and table, and both axes of Analysis.

| Query | Example | Meaning |
|---|---|---|
| `devices` | `INV06,INV07` | comma-separated device ids |
| `param` | `P_AC` | the tag (see list below) |
| `from`, `to` | ISO times | window; `to` is not included |
| `interval` | `5m`, `15m`, `1h`, `1d` | bucket size |
| `agg` | `avg` (default), `max`, `last` | how a bucket is reduced |

Monitoring's Week and Month views ask for `interval=1d&agg=max` (each day's peak).

```json
{
  "param": "P_AC",
  "unit": "kW",
  "interval": "5m",
  "times": ["2026-07-27T00:00:00+05:30", "2026-07-27T00:05:00+05:30"],
  "series": [
    { "deviceId": "INV06", "values": [0, 0] },
    { "deviceId": "INV07", "values": [null, 0] }
  ]
}
```

Tags the portal asks for (in `src/config/parameters.ts`):

| Group | Tags |
|---|---|
| AC power | `P_AC` kW, `S_AC` kVA, `Q_AC` kVAR, `COS_PHI` |
| AC electrical | `V_AC` V, `I_AC` A, `F_AC` Hz |
| DC input | `P_DC` kW, `V_DC` V, `I_DC` A |
| Energy | `E_TODAY` kWh, `E_TOTAL` kWh |
| Temperature | `T_INT`, `T_MOD`, `T_AMB`, `T_OIL` °C |
| Irradiance | `GHI`, `POA` W/m² |
| Performance | `PR` %, `CUF` %, `SPEC_YIELD` kWh/kWp |

If a device does not report a tag, return `null` values for it (not zeros).


## KPI page

### `GET /sites/{siteId}/kpi`

| Query | Meaning |
|---|---|
| `metric` | `PR`, `CUF`, `AVAIL`, `YIELD`, `ENERGY`, `IRR` |
| `granularity` | `day` (every day of a month) or `month` (every month of a year) |
| `year`, `month` | `month` only with `granularity=day` |

```json
{
  "buckets": [
    { "key": "2026-10-01", "actual": 67.7, "simulated": 81.4, "forecast": null, "partial": false },
    { "key": "2026-10-20", "actual": null, "simulated": 81.4, "forecast": 76.5, "partial": false }
  ]
}
```

- `actual`: measured. Only for time that has passed.
- `simulated`: what the design model says.
- `forecast`: only for time still to come.
- `partial`: true for the current month in month view (actual covers the part that
  has passed, forecast the rest).
- A month must equal the total of its days, so the two views agree.


## Settings

### Who sees what

| Account | Settings screens |
|---|---|
| Customer admin (`accountType: "admin"`) | All ten: User Profile, Company Profile, Customer Devices, Emission Rate, Electricity Rate, Energy Offset, Alarms config, Role, User, Access Control |
| User (`accountType: "user"`) | User Profile and Customer Devices only. Devices are read-only (no rename). |

For a user, the portal does not call any of the admin-only calls below. The
backend must still refuse them (`403`), because hiding a screen is not
security:

- `GET /account/company`
- `PATCH /sites/{siteId}/devices/{deviceId}` (rename)
- everything under `/sites/{siteId}/rates/...` and `/sites/{siteId}/energy-offsets...`
- everything under `/account/alarm-recipients`, `/account/roles` and `/account/users`

A user can still read and edit their own profile and change their own password.
`GET /sites` should return only the sites the user's role reaches.

### Profile and company

| Call | Sends | Returns |
|---|---|---|
| `GET /account/profile` | – | `{ first, last, company, address, email, phone, roleLabel }` |
| `PUT /account/profile` | `{ first, last, company, address, email, phone }` | anything |
| `POST /account/password` | `{ current, next }` | anything; wrong `current` → `403` with a message |
| `GET /account/company` | – | `{ name, address, companyEmail, adminEmail, phone, serviceActive }` |

### Devices

| Call | Sends |
|---|---|
| `PATCH /sites/{siteId}/devices/{deviceId}` | `{ name }` (rename) |

### Emission and electricity rates

`{kind}` is `emission` (kg CO₂ per kWh) or `electricity` (₹ per kWh).

| Call | Sends | Returns |
|---|---|---|
| `GET /sites/{siteId}/rates/{kind}` | – | `[ { from: "2025-04-01", rate: 0.727, addedAt } ]` |
| `POST /sites/{siteId}/rates/{kind}` | `{ from, rate }` | anything |
| `DELETE /sites/{siteId}/rates/{kind}/{from}` | – | anything |

A rate has no end date. It runs until the next one starts. Only the latest rate
can be removed. The screen already checks this, but the backend should check it
too.

### Energy offsets

| Call | Sends | Returns |
|---|---|---|
| `GET /sites/{siteId}/energy-offsets` | – | `[ { deviceId, from, kwh, reason, addedAt } ]` |
| `POST /sites/{siteId}/energy-offsets` | `{ deviceId, from, kwh, reason }` | anything |
| `DELETE /sites/{siteId}/energy-offsets/{deviceId}/{from}` | – | anything |

Same history rules as rates, kept separately for each device. `kwh` can be
negative. `0` ends a correction.

### Alarm recipients

| Call | Sends | Returns |
|---|---|---|
| `GET /account/alarm-recipients` | – | `[ { id, name, email, severities: { critical, alarm, warn, event } } ]` |
| `POST /account/alarm-recipients` | `{ name, email, severities }` | anything |
| `PUT /account/alarm-recipients/{id}` | same | anything |
| `DELETE /account/alarm-recipients/{id}` | – | anything |

### Roles, users and access

| Call | Sends | Returns |
|---|---|---|
| `GET /account/roles` | – | `[ { id, name, siteIds: [] } ]` |
| `POST /account/roles` | `{ name, siteIds }` | anything |
| `PUT /account/roles/{id}` | `{ name, siteIds }` | anything |
| `DELETE /account/roles/{id}` | – | anything (only when nobody holds the role) |
| `GET /account/users` | – | `[ { id, first, last, email, phone, roleId, active } ]` |
| `POST /account/users` | `{ first, last, email, phone }` | anything |
| `PUT /account/users/{id}` | `{ first, last, email, phone }` | anything (does not change the role) |
| `PUT /account/users/{id}/status` | `{ active }` | anything (suspend / reactivate) |
| `PUT /account/users/{id}/role` | `{ roleId }` (`null` = no role) | anything |

Users are never deleted, only suspended.


## Top bar

### `GET /data-communications/logger-status`

The notification button just before the light/dark button on Home, Monitoring,
Alarms, Analysis and KPI. Asked when the page opens and again every 3 minutes.

```json
[
  { "loggerName": "Sangria logger 1", "status": true },
  { "loggerName": "Mendoza logger 2", "status": false }
]
```

- One row per logger of the signed-in customer.
- `status`: `true` when the logger's data is live, `false` when it is not.
  Anything else is shown as a dash.
- The dot on the button is green only when every logger is `true`. It is red
  when any is `false`, when the list is empty, or when the call fails.
- The live sunhub.in site already has this call with these field names:
  `GET /api/v1/data-communications/logger-status`.


## Stored in the browser (no backend needed)

| Key | What |
|---|---|
| `enerops-token` | session token (bearer mode) |
| `enerops-theme` | `light` / `dark` |
| `enerops-plant` | the selected site id |
| `enerops-analysis-views` | saved views on Analysis. Can move to the backend later. |
