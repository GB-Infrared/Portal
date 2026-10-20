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
| `POST /auth/login` | `{ email, password }` | `{ token, user: { id, name, email, role, accountType, level } }` |
| `POST /auth/logout` | – | anything |
| `GET /auth/me` | – | `{ id, name, email, role, accountType, level }` (the signed-in user) |
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
- `level` is only for the EnerOps team who use the web admin panel:
  `"super"` (Super Admin), `"admin"` (Admin) or `"plant"` (Plant Admin). For
  everyone else it is `null` or left out. See "Web admin panel" below.
- After sign-in a Super Admin lands on the web admin panel (`/admin`). Everyone
  else, an Admin and a Plant Admin included, lands on Site Control.
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
| `status=active` | only alarms that are still open, acknowledged ones included (Home) |
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
    "category": "inverter",
    "acknowledgedBy": null,
    "acknowledgedAt": null,
    "acknowledgeNote": null
  }
]
```

- `severity`: `critical`, `alarm`, `warn` (or `warning`), `event`.
- `status`: `active`, `acknowledged` or `resolved`. An acknowledged alarm is
  still open. It becomes `resolved` when the device clears it.
- `acknowledgedBy`, `acknowledgedAt`, `acknowledgeNote`: filled once someone
  acknowledges the alarm, otherwise `null`. `acknowledgedBy` is the person's
  name, as it should be shown.
- The Alarms page filters by device, severity and status in the browser, so
  return the whole window. If windows get very large, tell us and we will move the
  filters to the server.

### `POST /sites/{siteId}/alarms/{alarmId}/acknowledge`

The ACKNOWLEDGE button on an open alarm, on the Alarms page.

Sends `{ "note": "Technician sent to site" }`. The note can be empty. The
backend records who did it and when (from the session) and returns anything.
After this, `GET /sites/{siteId}/alarms` returns the alarm with
`status: "acknowledged"` and the three acknowledge fields filled.

The Acknowledged column (who, when, note) is shown only to web admin users
(`level` set). Customers can acknowledge but do not see the column.


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

`values` holds the tags this kind of device reports, and the panel shows them
in its own layout:

| Device | `values` the panel reads |
|---|---|
| Inverter (`INV`) | `P_AC` (against `ratedKw`), `S_AC`, `Q_AC`, `F_AC`, `COS_PHI`, `I_AC1`, `I_AC2`, `I_AC3` |
| Meter (`MFM`) | `P_AC`, `S_AC`, `Q_AC`, `F_AC`, `COS_PHI`, `V_AC`, `I_AC` |
| Weather station (`WMS`) | `GHI`, `POA`, `T_AMB`, `T_MOD` |
| Transformer (`TRF`) | `P_AC`, `V_AC`, `I_AC`, `T_OIL` |

Monitoring lists only the devices of the type chosen in Device type (by
`kind` from `GET /sites/{siteId}/devices`), and charts the chosen data point
for them with `GET /sites/{siteId}/timeseries`.

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
| Web admin user (`level` set), opened from the account menu as Customer Admin | All ten. A Plant Admin sees them read-only: no add, edit, delete or save, and no role pickers. |

For a user, the portal does not call any of the admin-only calls below. The
backend must still refuse them (`403`), because hiding a screen is not
security:

- `GET /account/company`
- `PATCH /sites/{siteId}/devices/{deviceId}` (rename)
- everything under `/sites/{siteId}/rates/...` and `/sites/{siteId}/energy-offsets...`
- everything under `/account/alarm-recipients`, `/account/roles` and `/account/users`

A user can still read and edit their own profile and change their own password.
`GET /sites` should return only the sites the user's role reaches.

For a web admin user, every `/account/...` call means the customer account they
are looking at. Their User Profile here is that customer's profile (the customer
admin's), read with `GET /account/company/admin`, not their own. Change password
is not offered on it. The backend must refuse every change from a Plant Admin
(`403`) on these screens.

### Profile and company

| Call | Sends | Returns |
|---|---|---|
| `GET /account/profile` | – | `{ first, last, company, address, email, phone, roleLabel }` |
| `PUT /account/profile` | `{ first, last, company, address, email, phone }` | anything |
| `POST /account/password` | `{ current, next }` | anything; wrong `current` → `403` with a message |
| `GET /account/company` | – | `{ name, address, companyEmail, adminEmail, phone, serviceActive }` |
| `GET /account/company/admin` | – | the customer admin's profile, same shape as `GET /account/profile`. Only called for web admin users. |
| `PUT /account/company/admin` | same as `PUT /account/profile` | anything. Super Admin and Admin only. |

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


## Site Control: plant warnings

### `GET /alarms/communication`

Open communication alarms across all the customer's sites. Site Control shows
one warning card per plant at the bottom right, with "Open plant" and a close
button. Asked when Site Control opens and again every 5 minutes.

```json
[
  { "siteId": "SANGRIA-01", "code": "ALM_994", "text": "Curator offline", "deviceName": "Sangria logger 1", "receivedAt": "2026-07-27T16:48:00+05:30" },
  { "siteId": "MENDOZA-01", "code": "ALM_999", "text": "Communication Error", "deviceName": "INV03", "receivedAt": "2026-07-27T17:12:00+05:30" }
]
```

- Only codes `ALM_991` to `ALM_999` make a card. Other codes are ignored.
- `text` can be left out. The portal then uses its own name for the code:

| Code | Name |
|---|---|
| `ALM_991` | Curator restarting |
| `ALM_992` | SD card fault |
| `ALM_993` | Network problem |
| `ALM_994` | Curator offline |
| `ALM_995` | Data not delivered |
| `ALM_996` | Clock not set |
| `ALM_997` | Invalid response length |
| `ALM_998` | Invalid CRC |
| `ALM_999` | Communication Error |

- Return only alarms that are still open. When the list is empty there are no
  cards.
- `siteId` must match an `id` from `GET /sites`.


## Web admin panel

The panel the EnerOps team uses to set customers up. It opens at `/admin`, only
for a user with `level` set. Anyone else who opens `/admin` is sent to Home.

| Level | What they can do |
|---|---|
| Super Admin (`super`) | Everything below. |
| Admin (`admin`) | Everything except customers. Their user screen is called Plant Admin: it lists only Plant Admins, and a user they add is always a Plant Admin. |
| Plant Admin (`plant`) | No Account Management and no Device catalogue screens. Sees only the customers their role reaches. Adds plants for those customers, and changes or deletes only the plants they added, with those plants' loggers and devices. Their profile is read-only, but they can change their password. |

The screens hide what a level cannot do. The backend must refuse it as well
(`403`).

IDs are made by the backend. The Add plant form shows "Made when saved" where
the ID goes.

Their own profile uses the same calls as Settings: `GET` / `PUT /account/profile`
and `POST /account/password`.

### Customers

| Call | Sends | Returns |
|---|---|---|
| `GET /admin/customers` | – | `[ { id, name, legalName, companyEmail, phone, address, adminFirst, adminLast, adminEmail, plantCount, loggerCount, deviceCount } ]` |
| `POST /admin/customers` | `{ name, legalName, companyEmail, phone, address, adminFirst, adminLast, adminEmail }` | anything |
| `PUT /admin/customers/{id}` | same | anything |
| `DELETE /admin/customers/{id}` | – | anything. Its plants, loggers and devices go with it. |

- Only a Super Admin adds, edits or deletes. An Admin and a Plant Admin still
  call `GET`, to pick a customer on the plant screens. For a Plant Admin, return
  only the customers their role reaches.
- `adminEmail` signs in to the customer panel. If another customer already uses
  it, answer `409` with a message.

### Plants

| Call | Sends | Returns |
|---|---|---|
| `GET /admin/plants?customerId=...` | – | `[ plant ]` |
| `POST /admin/plants` | a plant without `id`, `addedBy`, `loggerCount`, `deviceCount` | anything |
| `PUT /admin/plants/{id}` | same | anything |
| `DELETE /admin/plants/{id}` | – | anything. Its loggers and devices go with it. |

```json
{
  "id": "52807316",
  "customerId": "48210375",
  "name": "Sangria",
  "area": "Nathwana", "city": "Hanumangarh", "state": "Rajasthan", "country": "India", "zip": "335073",
  "lat": 29.80, "lng": 74.47,
  "address": "2 DLP, Kikarwali Road, Nathwana",
  "description": "Ground-mount, fixed tilt",
  "acKw": 2500, "dcKwp": 2500, "pstcKwp": 2500, "moduleWp": 540, "minIrradiance": 50,
  "installedOn": "2021-03-12",
  "irradiationSensors": ["WMS01"],
  "pages": ["Home", "Monitoring", "Alarms", "Analysis", "KPI"],
  "irradiance": "inclined",
  "timezone": "Asia/Kolkata",
  "homeSources": {
    "power":      { "source": "meter",    "meter": "MET01" },
    "energy":     { "source": "inverter", "meter": "" },
    "generation": { "source": "inverter", "meter": "" }
  },
  "energySource": { "source": "meter", "meter": "MET01" },
  "metricMeters": { "pr": "MET01", "cuf": "MET01", "grid": "", "plant": "", "yield": "", "loss": "" },
  "homeKpi": "pr",
  "kpi": { "pr": { "bar": false, "aux": false, "poi": false }, "cuf": { "bar": true, "aux": false, "poi": false } },
  "addedBy": "admin@enerops.in",
  "loggerCount": 2,
  "deviceCount": 10
}
```

- `pages` always has Home, Monitoring and Alarms. Analysis and KPI are a choice.
- `irradiance` is `inclined` (POA) or `horizontal` (GHI).
- `homeSources` is the Home Page Data Source block: where Home's Plant Power,
  Plant Energy and Energy Generation come from. `source` is `inverter` or
  `meter`. With `meter`, `meter` names one meter of this plant.
- Meters and irradiation sensors are named by their customer device name
  (`MET01`, `WMS01`), which is unique within a plant.
- `kpi` has one entry per metric: `pr`, `cuf`, `grid`, `plant`, `yield`, `loss`.
  `homeKpi` is the one Home shows first.
- `addedBy` is the email of whoever added the plant. The backend sets it on
  `POST`. A Plant Admin may `PUT` or `DELETE` a plant only when it is theirs.

### Loggers

| Call | Sends | Returns |
|---|---|---|
| `GET /admin/loggers?plantId=...` | – | `[ { id, plantId, name, description, deviceCount } ]` |
| `POST /admin/loggers` | `{ plantId, name, description }` | anything |
| `PUT /admin/loggers/{id}` | same | anything |
| `DELETE /admin/loggers/{id}` | – | anything. Its devices go with it. |

### Customer devices

| Call | Sends | Returns |
|---|---|---|
| `GET /admin/devices?loggerId=...` | – | `[ { id, loggerId, modelId, name, serial } ]` |
| `GET /admin/devices?plantId=...` | – | the same, for every logger of the plant |
| `POST /admin/devices` | `{ loggerId, modelId, name, serial }` | anything |
| `PUT /admin/devices/{id}` | same | anything |
| `DELETE /admin/devices/{id}` | – | anything |

- `name` is what the customer panel shows (`INV01`). It must be unique within
  the plant. The form checks this, but answer `409` if it is not.
- `?plantId=` is used by the plant form to list the plant's meters and weather
  stations.

### Device catalogue

Read-only. Models are added with the firmware, not from the panel.

| Call | Returns |
|---|---|
| `GET /admin/catalog/models` | `[ { id, name, category, model, mapping } ]`. `category` is `Inverter`, `MFM` or `WMS`. |
| `GET /admin/catalog/models/{id}/sensors` | `[ { name, code, tag, unit, category } ]` |

A Plant Admin does not see these screens, but the device form still calls
`GET /admin/catalog/models`.

### Users, roles and access

Super Admin and Admin only.

| Call | Sends | Returns |
|---|---|---|
| `GET /admin/team` | – | `[ { id, first, last, email, phone, level, roleId } ]` |
| `POST /admin/team` | `{ first, last, email, phone, level }` | anything |
| `DELETE /admin/team/{id}` | – | anything |
| `PUT /admin/team/{id}/role` | `{ roleId }` (`null` = no role) | anything |
| `GET /admin/roles` | – | `[ { id, name, customerIds } ]` |
| `POST /admin/roles` | `{ name, customerIds }` | anything |
| `PUT /admin/roles/{id}` | `{ name, customerIds }` | anything |
| `DELETE /admin/roles/{id}` | – | anything. Users who held it are left with no role. |

- `level` is `admin` or `plant`. Leave the Super Admin out of the list.
- For an Admin, return only Plant Admins, and treat any user they add as a
  Plant Admin whatever `level` says.
- An email that already signs in somewhere answers `409` with a message.
- A role decides which customers someone reaches. Their level decides what they
  can do there.


## Stored in the browser (no backend needed)

| Key | What |
|---|---|
| `enerops-token` | session token (bearer mode) |
| `enerops-theme` | `light` / `dark` |
| `enerops-plant` | the selected site id |
| `enerops-analysis-views` | saved views on Analysis. Can move to the backend later. |
