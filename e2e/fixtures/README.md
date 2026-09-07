# e2e fixtures

Input files uploaded by the e2e suite.

| File | Used by | State |
|------|---------|-------|
| `validation-exceptions.csv` | `admin-crud.spec.ts` (singleton upload/remove) | **Real.** Content is not parsed on upload, so a trivial CSV suffices. |
| `reference-data.json` | global setup (reuse-or-upload), `reference-report.spec.ts`, `admin-crud.spec.ts` (duplicate-rejection 409 test) | **Real.** A synthetic multi-department network benchmark captured from a seeded stack. |
| `reference-data-crud.json` | `admin-crud.spec.ts` (reference-data list upload/delete) | **Derived** from `reference-data.json` (one metadata count bumped → valid but byte-distinct). The reporting service dedups identical content, so the CRUD upload needs a dataset the seed / global setup has **not** already stored; re-uploading `reference-data.json` itself is the 409 test. |
| `partner-data.json` | `partner-report-data-file.spec.ts` | **Real.** A synthetic department dataset captured from a seeded stack. |

## The two report datasets

`reference-data.json` and `partner-data.json` are the JSON payloads neoipcr
produces — a reference (benchmark) dataset and a partner (department) dataset.
The reference-data upload **derives its metadata from the content** (reporting
period, countries), and the reports **render** from these payloads, so a stub
cannot stand in: the render would fail. They are therefore **captured from a
seeded stack** — only synthetic play-package data, never real patient content.

The suite keeps a graceful-degrade fallback: if either file is reset to the
`__placeholder__` sentinel, the dependent specs **skip** instead of failing
opaquely —

- global setup **skips** the reference-data upload and records no fixture, whether
  or not the stack already holds a seeded benchmark;
- `reference-report.spec.ts` **skips** with a pointer here, and so does each
  reference-data test in `admin-crud.spec.ts` when the fixture it keys off is the
  placeholder — `reference-data.json` for the duplicate-rejection test,
  `reference-data-crud.json` for the list upload/delete;
- `partner-report-data-file.spec.ts` **skips**.

Every other spec runs regardless — `reference-report-live-fetch.spec.ts` included,
which takes the empty-listing branch when the stack holds no dataset at all.

## How to re-capture

Against a seeded stack, over an admin DHIS2 session (the neoipcr JSON output is
locale-independent, so any served `Accept-Language` works):

1. **`reference-data.json`** — the neoipcr-serialised reference (benchmark)
   dataset: `GET /neoipc/api/reference-report` with `Accept: application/json`
   (ad-hoc admin mode). The default excludes test units, so it aggregates the
   seeded **non-test** departments into the network benchmark; seed enough of
   them (≥ 5) that the cross-department quartiles are not degenerate.
2. **`partner-data.json`** — the neoipcr-serialised department dataset the
   Partner Report's data-file mode accepts:
   `GET /neoipc/api/partner-report?unitCodes=AT_TEST_TEST` with
   `Accept: application/json`. `AT_TEST_TEST` is a **non-test** department, so no
   `includeTestData` is needed; to capture a test-unit dataset instead, use the
   dedicated `unitCodes=AT_TEST_TEST2&includeTestData=true`.

Drop each captured file in place (removing the `__placeholder__` key). The
dependent specs then run automatically.

After re-capturing `reference-data.json`, regenerate its derived sibling so the
two stay in lock-step — a single bumped metadata count keeps it valid but
byte-distinct (run from this directory):

```sh
python - <<'PY'
import json
d = json.load(open('reference-data.json', encoding='utf-8'))
names = d['attributes']['names']['value']
d['value'][names.index('n_departments')]['value'][0] += 1
json.dump(d, open('reference-data-crud.json', 'w', encoding='utf-8', newline='\n'),
          separators=(',', ':'), ensure_ascii=False)
PY
```

**Do not** commit real patient-derived content here — capture only synthetic
(play-package) data.
