# Changelog

Notable changes to the NeoIPC DHIS2 app.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version lives in
[package.json](package.json). The release workflow reads the section matching the released version
out of this file and publishes it as the GitHub Release body, so a release cannot be cut for a
version this file does not describe. Work on `main` since the last release is listed under
Unreleased until it is versioned.

## [Unreleased]

## [0.2.0-alpha] - 2026-10-01

### Added

- A test that fails when a report form's initial value disagrees with the report schema's default
  for a field the request always sends, so an untouched form cannot silently render something other
  than the report's own default. Fields the form leaves unset are held to being omitted from the
  request instead.
- A Validation Report page, for holders of the report authority, with a shortcut in the command
  palette. It renders the NeoIPC Validation Report as HTML or PDF for the departments picked, every
  department the user can see when none is. Its "More options" section lists every validation rule
  with a one-sentence summary of what it checks, read from the report itself in the interface
  language where it is translated, so a rule the report gains appears without an app release; every
  rule is applied until the user narrows the selection. "Select all" restores every rule, and "Clear
  all" unticks them all so a few can be picked. Administrators can also include the test
  departments. The page needs NeoIPC-Reporting 0.4.0 or later, which serves the
  `/validation-report` endpoints.
- A "Data validation summary table" content toggle on the Partner and Reference Report forms, for
  the table the reports show first after their header. It is on by default and follows the content
  presets like the other tables; it needs NeoIPC-Reporting 0.4.0 or later, which accepts
  `includeValidationSummaryTable`.

### Changed

- The Reference Report's department filter labels each department with its hospital, as the Partner
  Report's picker does, so departments of the same name in different hospitals can be told apart.

### Fixed

- A link to a place in an HTML report shown in the app, such as a cross-reference to a table or to a
  problem's details, sent the app to its first page and discarded the report, because the app routes
  on the part of the address such a link changes. It now scrolls to its target and moves the focus
  there. A web link that leaves the report, such as a patient's Tracker Capture dashboard, opens in a
  new tab, so the report stays on screen.
- The page's scrollbar could not be dragged to the end of a long report: the app's pages were as tall
  as the whole window although they start below the DHIS2 header bar, so the scrollbar's lower end
  lay below the window's edge. The pages now fill only the area below the header bar.
- With the report language left blank, the Partner and Reference Reports were rendered in the
  browser's language, although the form said they would follow the DHIS2 user setting. A blank
  report language now selects the DHIS2 interface language when the report is available in it, and
  English otherwise, on these two forms and on the Validation Report's. Generate waits for the list
  of the report's languages to load; when the list cannot be loaded, the request carries no
  language, and the reporting service chooses one from the browser's languages. The Partner
  Report's JSON dataset download, which carries codes rather than text, sends no language, not even
  one picked in the form, since the reporting service can refuse a language for that download that
  it accepts for the report.
- A failure to load a report's content presets hid the language choice on the Partner and Reference
  Report forms and left their preset picker loading for good, with the content options locked. The
  presets and the languages now load independently, and without the presets the forms fall back to
  Custom, with the content options unlocked and a note that the presets could not be loaded.

## [0.1.0-alpha] - 2026-09-07

### Added

- A JSON download of the partner data the reporting service computes for the chosen department and
  period — the file the Partner Report's data-file mode renders from. Choosing it disables the file
  upload, since only the live data produces it.
- The interface catalogues for all nine languages now carry the full source-string set and are
  translated on Weblate, which is their only writer; German has its first translations.
- End-to-end coverage of the Reference Report's admin-only live-fetch filters, of the JSON download,
  and of accessibility — axe-core, WCAG 2.1 A and AA, over the main routes for each persona — and a
  suite login that works on DHIS2 2.40 as well as 2.41 and later.
- Continuous-integration gates for text-file hygiene (LF, UTF-8, no byte-order mark), for catalogue
  ownership (a pull request may not hand-edit an `i18n/<lang>.po`), and for this file describing
  `package.json`'s version.

### Changed

- The app is named `NeoIPC`: that is its manifest short name, the key it is served under
  (`/api/apps/NeoIPC/`), the See-App authority DHIS2 derives from it (`M_NeoIPC`), and its dataStore
  namespace. The renamed bundle installs alongside an existing `neoipc-app` install rather than
  replacing it.
- The Partner Report form names a partner's single selectable department instead of offering a
  picker with one entry, its label and value paired as a description list; the picker returns as
  soon as there is a real choice.
- The Reference Report's hospitals filter is a departments filter, which is the level surveillance
  is observed at.
- A GitHub Release's body is this file's section for the released version; a release cannot be cut
  while that section is missing or empty.

### Fixed

- The Reference Report's test-unit control did the opposite of what it said: choosing *Include*
  excluded test units and *Exclude* admitted them. It is now a checkbox, "Include test data", that
  names the outcome it produces.
- The header bar's unread-count badges fell below the WCAG AA contrast threshold.

## [0.0.1-alpha] - 2026-07-06

First published version.

### Added

- The Partner Report and Reference Report forms, rendering to inline HTML or a PDF download through
  the NeoIPC reporting service.
- Administration of the reference datasets the Reference Report is rendered from, and of the
  validation-exception file.
- Authority-filtered navigation: what a user sees follows the `F_NEOIPC_*` authorities they hold, so
  a report-only user is offered neither admin view.
- Per-user org-unit scoping on the department picker, so a partner reaches their own department and
  no other.
- A user interface that follows the DHIS2 user's own locale setting. The catalogues for the nine
  target languages hold a single translated label (German) in this version, so the interface is in
  practice English.

[Unreleased]: https://github.com/NeoIPC/NeoIPC-App/compare/v0.2.0-alpha...HEAD
[0.2.0-alpha]: https://github.com/NeoIPC/NeoIPC-App/compare/v0.1.0-alpha...v0.2.0-alpha
[0.1.0-alpha]: https://github.com/NeoIPC/NeoIPC-App/compare/v0.0.1-alpha...v0.1.0-alpha
[0.0.1-alpha]: https://github.com/NeoIPC/NeoIPC-App/releases/tag/v0.0.1-alpha
