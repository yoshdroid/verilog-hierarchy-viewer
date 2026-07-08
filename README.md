# Verilog Hierarchy Viewer

VS Code extension for inspecting Verilog HDL/SystemVerilog module hierarchy.

## Features

- Scan `.v`, `.sv`, `.vh`, and `.svh` files in the current workspace.
- Select a TOP module from detected module definitions.
- Show the instantiated hierarchy in Explorer as `HDL Hierarchy`.
- Jump from each module or instance node to the corresponding source line.
- Refresh manually or automatically when source files change.
- Report duplicate modules, unresolved modules, cycles, and parse summary in the `Verilog Hierarchy` output channel.

## Build

Install Node.js LTS first. Then run:

```powershell
git clone https://github.com/yoshdroid/verilog-hierarchy-viewer.git
cd verilog-hierarchy-viewer
npm install
npm test
```

On PowerShell environments where `npm.ps1` is blocked by execution policy, call `npm.cmd` instead:

```powershell
npm.cmd install
npm.cmd test
```

## Create a VSIX

The project includes `@vscode/vsce` as a dev dependency.

```powershell
npm run package
```

This creates a file like:

```text
verilog-hierarchy-viewer-0.0.1.vsix
```

## Install from VSIX

In VS Code:

1. Open Extensions.
2. Select `...`.
3. Select `Install from VSIX...`.
4. Choose `verilog-hierarchy-viewer-0.0.1.vsix`.
5. Open a workspace that contains Verilog HDL/SystemVerilog source files.

Command line alternative:

```powershell
code --install-extension .\verilog-hierarchy-viewer-0.0.1.vsix
```

## Use

1. Open a Verilog HDL/SystemVerilog workspace.
2. Run `Verilog Hierarchy: Select Top Module` from the command palette.
3. Choose the TOP module.
4. Open Explorer and find `HDL Hierarchy`.
5. Click a tree node to jump to the module or instance declaration.

## Settings

- `verilogHierarchy.fileExtensions`: source extensions to scan.
- `verilogHierarchy.exclude`: glob patterns excluded from scanning.
- `verilogHierarchy.maxDepth`: maximum hierarchy depth.
- `verilogHierarchy.autoRefresh`: refresh when source files change.
- `verilogHierarchy.includePaths`: reserved for future preprocessor support.
- `verilogHierarchy.defines`: reserved for future preprocessor support.

## Current Limitations

- Preprocessor directives and `include` files are not expanded.
- Macro-generated module or instance names are not resolved.
- Complex SystemVerilog elaboration is not performed.
- Multiple instances in one declaration are not fully handled.

