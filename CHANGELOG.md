# Changelog

## [0.0.3] - 2026-07-09

### Added

- Add basic preprocessing before hierarchy parsing.
- Expand active `` `include "file.vh" `` directives from the including file directory, configured include paths, or an unambiguous workspace basename match.
- Apply configured `verilogHierarchy.defines` to `` `ifdef ``, `` `ifndef ``, `` `elsif ``, `` `else ``, and `` `endif `` conditional blocks.
- Report include and unsupported macro warnings in the `Verilog Hierarchy` output channel.

### Changed

- Make `verilogHierarchy.includePaths` and `verilogHierarchy.defines` active settings instead of reserved settings.

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
