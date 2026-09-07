# neoipc-app end-to-end (e2e) suite

Browser-driven tests (Playwright) that exercise behaviour type-checking and
unit tests can't: authority-driven nav filtering, per-user org-unit picker
scoping, report render (inline HTML fragment + PDF download), admin CRUD, and
UI-locale switching. They run against an **installed** app bundle served from a
DHIS2 origin — production fidelity, not the `yarn start:dev` proxy.

## What runs

| Spec | Covers |
|------|--------|
| `nav-authority` | Authority-filtered left-nav: superuser sees all four items; a report-only user sees the two report items and neither admin item. |
| `org-unit-picker` | Per-user department scoping (`withinUserHierarchy`): each report user sees only their country's department. |
| `partner-report-online` | Online render: HTML mounts `#neoipc-rendered-report`; PDF triggers a `partner-report.pdf` download. |
| `partner-report-data-file` | Render from an uploaded partner-data JSON, both formats. *(needs a real fixture — see [`fixtures/README.md`](fixtures/README.md); the spec self-skips without one)* |
| `partner-report-json` | The JSON output round trip: download the department dataset the Partner Report is computed from, feed it back through the upload path, and get a report out — the one assertion that catches the R producer and the Quarto consumer drifting apart. |
| `reference-report` | Render a stored reference dataset, both formats. *(needs a real fixture)* |
| `reference-report-live-fetch` | The admin-only live-fetch filters, which the report-only persona never sees: that "Include test data" admits `TEST_UNITS` departments to the Departments picker only when checked, and that it and the department selection reach the request. *(runs with or without a stored dataset: with none, the dataset picker gives way to a notice and the form is already in live mode)* |
| `admin-crud` | reference-data list (upload → row → delete); validation-exceptions singleton (upload → current file → remove). |
| `locale-switch` | `keyUiLocale=de` + reload flips the translated nav label. |
| `a11y` | axe-core (WCAG 2.1 A + AA) over the main routes per persona, tolerating only known `@dhis2/ui` component defects. Chromium only — axe evaluates the DOM, which is identical across engines. |

## Prerequisites

1. **Dependencies** — `@playwright/test` (via `yarn install`) and the three
   browser engines: `npx playwright install chromium firefox webkit`
   (add `--with-deps` on Linux for the engines' system libraries).
2. **A running, seeded DHIS2 stack** reachable at `DHIS2_BASE_URL`, with the
   play package imported (departments `AT_TEST_TEST`, `AT_TEST_TEST2` and
   `CH_TEST_TEST`, users `play.admin`, `play.at.report1`, `play.ch.report1`)
   and synthetic patients under `AT_TEST_TEST`. `AT_TEST_TEST2` must be in the
   `TEST_UNITS` group, and `AT_TEST_TEST` and `CH_TEST_TEST` must not, because
   the specs depend on that membership in both directions: the Partner Report
   form drops `TEST_UNITS` members from its department picker unless "Include
   test data" is checked, so the org-unit-picker and partner-report specs reach
   `AT_TEST_TEST` and `CH_TEST_TEST` only while both are outside the group; and
   the reference-report live-fetch spec reads the exclusion by which of
   `AT_TEST_TEST` and `AT_TEST_TEST2` the Departments picker offers. Global
   setup asserts that shape, so a stack seeded with
   `-TestUnitDepartmentCodes @()` is rejected. Global setup **installs the app
   bundle** into DHIS2 and asserts the seed is present; it does not seed.
3. **A built bundle** at `build/bundle/NeoIPC-<version>.zip` (`yarn build`).

## Auth model

Each persona is logged in **once**, and its `JSESSIONID` session is saved as a
Playwright `storageState` (`e2e/.auth/<user>.json`, git-ignored). The login is
**version-aware**, because the two supported DHIS2 lines do not share a mechanism:
2.41+ takes the JSON login at `POST /api/auth/login`, while 2.40 has only the
legacy Struts form-login at `POST /dhis-web-commons-security/login.action`.
`dhis2-login.ts` tries the modern route first and falls back.
Basic auth is deliberately **not** used: DHIS2's API is stateless
(`SessionCreationPolicy.NEVER`), so a Basic-auth call mints no auth-bearing
session, and the `/neoipc` reporting mount authenticates *only* by validating
that cookie. See `dhis2-login.ts`.

## Running

```sh
# all three engines
npx playwright test

# one engine (fast dev loop)
npx playwright test --project=chromium

# one spec, headed
npx playwright test --project=chromium --headed -g "org-unit-picker"
```

Environment (all have defaults for the local stack):

| Var | Default | Purpose |
|-----|---------|---------|
| `DHIS2_BASE_URL` | `http://localhost:8080` | Stack origin. |
| `DHIS2_ADMIN_USER` / `DHIS2_ADMIN_PASS` | `admin` / `district` | Installs the app + uploads the reference fixture. |
| `PLAY_USER_PASSWORD` | `NeoIPC-Play1` | Password on the seeded play users. |

The three engines run **serially** (`workers: 1`): every engine shares one DHIS2
substrate and the singleton validation-exceptions resource, so admin CRUD is the
binding constraint. Render assertions allow up to ~12 min (the Quarto/R backend
render can take ~10 min).

## Fixtures

See [`fixtures/README.md`](fixtures/README.md). Both report-dataset fixtures (`reference-data.json`,
`partner-data.json`) are real captures from a seeded stack; reset either to the `__placeholder__`
sentinel and its dependent specs skip.

## First-run notes

These are the points most likely to need a small adjustment on the first live
run:

- `@dhis2/ui` radio/multiselect gestures — `setDataSource`/`setOutputFormat`
  use `input.check()`; the department and dataset dropdown open/click may need
  tuning against the running widgets.
- The Partner Report reporting period uses a wide range set via `setDateField`
  (fill + blur, since `CalendarInput` commits to form state on blur); the range
  may want narrowing once the seeded demo-data date range is known.
