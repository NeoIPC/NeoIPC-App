# Changelog

Notable changes to the NeoIPC DHIS2 app.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version lives in
[package.json](package.json). The release workflow reads the section matching the released version
out of this file and publishes it as the GitHub Release body, so a release cannot be cut for a
version this file does not describe. Work on `main` since the last release is listed under
Unreleased until it is versioned.

## [Unreleased]

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

[Unreleased]: https://github.com/NeoIPC/NeoIPC-App/compare/v0.0.1-alpha...HEAD
[0.0.1-alpha]: https://github.com/NeoIPC/NeoIPC-App/releases/tag/v0.0.1-alpha
