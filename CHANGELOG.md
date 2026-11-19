# Changelog

Every change bumps `version` in `package.json` and adds an entry here, newest first. The version shows in the site footer and links to the changelog page.

- **Major**: breaking changes to stored data, URLs or file formats.
- **Minor**: new features and visible behavior changes.
- **Patch**: fixes, refactors, docs and tooling.

Visible changes also get a picture on the changelog page: add the version to `previews` in `src/components/changelog/previews.tsx`.

## [1.1.0] - 2026-11-18

### Changed

- The language is part of the address: French pages stay where they were, English pages are under /en (gas.puuid.com/en/history), so a shared link opens in the language it was shared in.
- If you had picked English before, your first visit takes you to the English address once.

## [1.0.1] - 2026-11-18

### Fixed

- In dark mode, the selected fuel on the map is filled and readable again instead of showing as a blank box.

## [1.0.0] - 2026-11-18

### Added

- A changelog page, opened from the version number at the bottom of the station list, in the menu, and in the footer of the price history page.

### Changed

- The price history page has the header and footer every puuid.com site shares: Plein's mark and name, links to the price history and the changelog, the language menu and a button back to the map, with the copyright, source code and version at the bottom.
- Buttons, inputs, menus and dialogs have rounded corners, like the other puuid.com sites.
- gas.puuid.com is the site's address; gas.odeschenes.dev now redirects there.
