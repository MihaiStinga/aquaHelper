# Rules (alerts)

Alerts come from rules written as JSON. The built-in ones live in
[`src/rules/default-rules.json`](../src/rules/default-rules.json); edit that file
and rebuild, or import your own file in the app (**Settings → Rules → Import
rules**). An imported rule with the same `id` as a built-in one replaces it.
Every rule can be switched off in the app.

Rules are checked whenever data changes, once a minute while the app is open,
and ahead of time for the daily notification (default 14:00, Settings → Alerts).

## A rule

```json
{
  "id": "ph-neons",
  "title": "pH {value}: watch the neons",
  "message": "pH is above 7.5. Neon tetras prefer soft, acidic water.",
  "severity": "warning",
  "tags": ["ph", "fish"],
  "when": { "param": "ph", "op": ">", "value": 7.5 },
  "advice": ["Check KH and CO₂.", "Do not chase pH with chemicals."]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique. Same id as a built-in rule = replaces it. |
| `title`, `message` | yes | Text; `{placeholders}` are filled in (see below). |
| `severity` | yes | `info`, `warning` or `critical` (push notification right away for warning/critical). |
| `when` | yes | The condition (below). |
| `advice` | no | Bullet list shown under “What to do”. |
| `tags` | no | Groups the rule on the Rules screen: `nitrogen`, `ph`, `co2`, `hardness`, `temperature`, `oxygen`, `plants`, `maintenance`. |
| `enabled` | no | `false` to ship a rule switched off. |
| `each` | no | With a top-level `any`: one alert per matching branch (used by “outside ideal range”). |

## Conditions

Parameter codes: `ph temp nh3 no2 no3 kh gh po4 k fe ca si cl o2 tds salinity`,
plus the calculated `co2` (from KH and pH) and `nh3_free` (free ammonia from
NH₃, pH and temperature). Units are the app's: ppm, °C. Operators (`op`):
`>`, `>=`, `<`, `<=`, `between` and `outside` (these two take `[low, high]`).

**Latest reading vs a number**

```json
{ "param": "nh3", "op": ">=", "value": 1 }
```

Optional on every parameter condition:
- `"maxAgeHours": 48` ignores readings older than that (default 168 = 7 days).
- `"hoursAfterWaterChange": { "min": 24, "max": 96 }` only matches when the reading was taken that long after the last water change.

**Outside the ideal range you set**

```json
{ "param": "temp", "outsideRange": true }
```

**Change over time** (window ending at the latest reading). `delta` = latest − earliest in the window, `spread` = max − min.

```json
{ "param": "ph", "change": { "withinHours": 24, "measure": "spread", "op": ">=", "value": 0.5 } }
```

**Ratio of two latest readings**

```json
{ "ratio": { "num": "no3", "den": "po4" }, "op": ">", "value": 30 }
```

**Days since a maintenance event** (`water_change` or `filter_clean`). `ifNever: true` also matches when it was never logged.

```json
{ "daysSince": "filter_clean", "op": "between", "value": [83, 90] }
```

**Tests not done** for N days (only parameters tested at least once count):

```json
{ "staleTests": ["ph", "nh3", "no2", "no3"], "days": 7 }
```

**Combining**: `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": {...} }`.

```json
{ "all": [
  { "param": "temp", "op": ">", "value": 27 },
  { "param": "co2", "op": ">", "value": 25 }
] }
```

## Placeholders

| Placeholder | From |
|---|---|
| `{value}` `{param}` | the matched reading (value with unit) and the parameter name |
| `{status}` | `outsideRange`: Low or High |
| `{hoursAfter}` `{daysAfter}` `{percent}` | with `hoursAfterWaterChange`: time since the water change and its % |
| `{change}` `{hours}` | change conditions: the delta/spread and the window |
| `{ratio}` `{num}` `{den}` | ratio conditions |
| `{days}` | `daysSince` |
| `{params}` | `staleTests`: the overdue parameters |

Unknown placeholders are left as written. In `all`/`any` the placeholders of
every matching part are available.

## Dismissing

Dismissing an alert hides it until its evidence changes, i.e. a new reading or
event makes the rule match again.
