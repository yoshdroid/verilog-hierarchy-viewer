# Changelog

## [0.0.2] - 2026-07-09

### Added

- Add `Verilog Hierarchy: Set as Top Module` to the hierarchy tree context menu.

### Fixed

- Fix false instance detection for compact HDL statements such as `if(...)`, `for(...)`, and `case(...)`.
- Fix false instance detection for assertion/property constructs such as `assert(...)` and `restrict property (...)`.

## [0.0.1] - 2026-07-09

### Added

- Initial MVP release.
- Select a TOP module from Verilog HDL/SystemVerilog sources.
- Show module hierarchy in VS Code Explorer.
- Jump from hierarchy nodes to source lines.
- Manual and automatic refresh.
- Duplicate, unresolved, and cycle warnings in the `Verilog Hierarchy` output channel.
- VSIX packaging workflow for GitHub Releases distribution.

