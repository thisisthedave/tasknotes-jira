# TaskNotes for Jira - Unreleased

## Added

- Added TaskNotes-compatible localization infrastructure with nested translation resources, locale normalization, fallback behavior, interpolation, and automatic selection from Obsidian's document language.
- Localized commands, startup and import notices, the Jira-key prompt, settings, mapping previews, loading and error states, and built-in TaskNotes field labels while preserving user-defined field names.
- Added localization unit coverage for locale selection, fallback, nested keys, and interpolation.
- Added searchable settings definitions for Obsidian 1.13 and later, including field sources, user-defined fields, sample issue previews, and value remapping controls.

## Changed

- Updated the plugin name shown in documentation to **TaskNotes for Jira**.
- Updated settings to use Obsidian's declarative settings API where available while retaining the existing renderer for compatibility.
- Pinned the Obsidian development dependency to the supported 1.13 API line.
- Changed the project license to the MIT License and synchronized package metadata.

## Fixed

- Addressed Obsidian plugin linter findings in the settings implementation and package metadata.
