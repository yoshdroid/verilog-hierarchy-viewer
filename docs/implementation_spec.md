# Verilog Hierarchy Viewer Implementation Spec

作成日: 2026-07-08

このドキュメントは現在の実装仕様を記録する。Phase 4 以降で実装が変わる場合は、このファイルへ追記してからコミットする。

## Phase 3 時点の概要

VS Code extension として、workspace 内の Verilog HDL/SystemVerilog ソースを走査し、検出した module を TOP module として選択できる。選択された TOP module から module instance をたどり、Explorer 配下の Tree View `HDL Hierarchy` に階層表示する。Tree node を選択すると、該当 module 宣言または instance 宣言のソース行へジャンプする。

## Extension Manifest

ファイル: `package.json`

Extension entry point:

- `main`: `./out/src/extension.js`

Activation:

- VS Code 1.95 では command/view contributions から activation event が自動生成されるため、`package.json` に明示的な `activationEvents` は置かない。

Commands:

- `verilogHierarchy.selectTopModule`: TOP module を Quick Pick で選択する。Tree node context から呼ばれた場合は、その node の module を TOP として再解決する。
- `verilogHierarchy.setAsTopModule`: `HDL Hierarchy` の tree node を右クリックし、その node の module を TOP として再解決する。
- `verilogHierarchy.refresh`: 現在選択中の TOP module で workspace を再走査し、Tree View を更新する。
- `verilogHierarchy.revealSource`: Tree node の source location を開く。

Views:

- `verilogHierarchy.view`: Explorer view container 配下の `HDL Hierarchy` Tree View。

Configuration:

- `verilogHierarchy.fileExtensions`: scan 対象拡張子。既定値は `.v`, `.sv`, `.vh`, `.svh`。
- `verilogHierarchy.exclude`: scan 除外 glob。既定値は `**/node_modules/**`, `**/.git/**`, `**/out/**`。
- `verilogHierarchy.includePaths`: 予約設定。Phase 3 では未使用。
- `verilogHierarchy.defines`: 予約設定。Phase 3 では未使用。
- `verilogHierarchy.maxDepth`: 階層解決の最大深さ。既定値は `100`。
- `verilogHierarchy.autoRefresh`: 対象 source 変更時に自動 refresh するか。既定値は `true`。

## Source Layout

```text
src/
  extension.ts
  hierarchy/
    model.ts
    parser.ts
    indexer.ts
    resolver.ts
  views/
    hierarchyLabels.ts
    hierarchyTreeProvider.ts
  workspace/
    workspaceIndexer.ts
test/
  hierarchy.test.ts
  hierarchyLabels.test.ts
```

## Data Model

ファイル: `src/hierarchy/model.ts`

- `SourceLocation`: `uri`, zero-based `line`, zero-based `character`。
- `ModuleInstance`: instance された module 名、instance 名、宣言位置、parameter override の有無。
- `ModuleDefinition`: module 名、module 宣言位置、配下の instance 一覧。
- `ModuleIndex`: module 名から最初に見つかった定義への map と、重複定義 map。
- `HierarchyNode`: Tree View に表示する解決済み階層 node。`unresolved` と `cycle` marker を持つ。

## Parser

ファイル: `src/hierarchy/parser.ts`

`parseModules(text, uri)` が 1 ファイル分の文字列から `ModuleDefinition[]` を返す。

Phase 3 時点の対応:

- line comment `// ...` を空白で mask する。
- block comment `/* ... */` を空白で mask する。
- `module <name>` から `endmodule` までを module body として扱う。
- module body 内の単純な instance 宣言を検出する。
- parameter override 付き instance `child #(...) u_child (...)` を検出する。
- arrayed instance `child u_child [N:0] (...)` の形を許容する。
- `assign`, `always`, `generate`, `if`, `function`, `task` など一部 keyword を instance として扱わない。

Phase 3 時点の制限:

- preprocessor は実行しない。
- `include` は解決しない。
- macro が module 名や instance 名に絡む場合は解決できない。
- nested parentheses が深い parameter override は完全には parse しない。
- multiple instances in one declaration は最初の instance のみを対象とする。
- SystemVerilog elaboration は行わない。

## Indexer

ファイル: `src/hierarchy/indexer.ts`

`buildModuleIndex(files)` が `SourceFile[]` から `ModuleIndex` を作る。

同名 module が複数ある場合:

- `modules` には最初に見つかった定義を採用する。
- `duplicates` に最初の定義を含めた重複定義一覧を保存する。
- Phase 3 時点では UI 上の選択や warning 表示は行わない。Output channel には重複 module 名の数だけ出す。

## Resolver

ファイル: `src/hierarchy/resolver.ts`

`resolveHierarchy(index, topModuleName, maxDepth)` が TOP module から DFS で `HierarchyNode` を構築する。

解決規則:

- TOP module が見つからない場合は `undefined` を返す。
- child module が index に存在しない場合は `unresolved: true` の node として tree に残す。
- 解決中の祖先 module 名に戻る instance は `cycle: true` の node として tree に残し、それ以上展開しない。
- `maxDepth` 以上はそれ以上展開しない。

## Workspace Scan

ファイル: `src/workspace/workspaceIndexer.ts`

`buildWorkspaceModuleIndex()` が VS Code workspace から対象ファイルを集め、`ModuleIndex` を作る。

実装:

- `vscode.workspace.getConfiguration('verilogHierarchy')` から拡張子と除外 glob を読む。
- `vscode.workspace.findFiles()` で対象 URI を収集する。
- `vscode.workspace.fs.readFile()` でファイル内容を読み、UTF-8 として decode する。
- `buildModuleIndex()` に渡す。

## Tree View

ファイル: `src/views/hierarchyTreeProvider.ts`

`HierarchyTreeProvider` は `TreeDataProvider` として以下を提供する。

- TOP 未選択時は message item を 1 件表示する。
- TOP 選択後は root `HierarchyNode` を `HierarchyTreeItem` として表示する。
- child node は `HierarchyTreeItem.node.children` から lazy に返す。

Tree label:

- root module: `top`
- child instance: `u_child : child`
- unresolved: `u_missing : missing (unresolved)`
- cycle: `u_cycle : top (cycle)`

ファイル: `src/views/hierarchyLabels.ts`

- `formatHierarchyLabel()` は Tree label を生成する純粋関数。
- Unit test で root、instance、unresolved、cycle 表示を確認する。

## Commands

ファイル: `src/extension.ts`

`activate()` で Output channel、TreeDataProvider、commands を登録する。

`verilogHierarchy.selectTopModule`:

1. Tree item 引数がある場合、その item の `moduleName` を TOP として refresh する。
2. 引数がない場合、workspace を scan する。
3. module 名を Quick Pick に表示する。
4. 選択された module を `selectedTopModule` に保存する。
5. hierarchy を解決して Tree View に渡す。

`verilogHierarchy.setAsTopModule`:

1. `HDL Hierarchy` の tree item context menu から実行する。
2. 対象 item の `node.moduleName` を `selectedTopModule` に保存する。
3. workspace を再 scan し、その module を TOP として hierarchy を再解決する。

`verilogHierarchy.refresh`:

1. `selectedTopModule` がない場合は empty message に戻す。
2. TOP がある場合は workspace を再 scan し、hierarchy を再解決する。

`verilogHierarchy.revealSource`:

1. Tree item の `node.declaration` を取得する。
2. `vscode.workspace.openTextDocument()` で URI を開く。
3. `vscode.window.showTextDocument()` で該当行・文字位置を selection として開く。

## Tests

テスト実行:

```powershell
npm test
```

PowerShell の execution policy により `npm.ps1` が blocked される環境では `npm.cmd test` を使う。

Phase 3 時点のテスト:

- `parseModules detects module declarations and instances`
- `parseModules ignores commented-out modules and instances`
- `buildModuleIndex tracks duplicate module definitions`
- `resolveHierarchy builds children, unresolved nodes, and cycles`
- `formatHierarchyLabel shows root module name`
- `formatHierarchyLabel shows instance and module names`
- `formatHierarchyLabel marks unresolved and cycle nodes`

## Manual Check Notes

Phase 3 時点では、この Codex 実行環境から VS Code GUI の Extension Development Host は起動していない。代替確認として以下を実施した。

- TypeScript compile check。
- Node.js unit tests。
- `package.json` の command/view contribution の静的確認。

次にユーザー環境の VS Code で確認する場合:

1. この repository を VS Code で開く。
2. `npm install` 済みであることを確認する。
3. F5 で Extension Development Host を起動する。
4. Verilog/SystemVerilog fixture を含む workspace を開く。
5. Command Palette から `Verilog Hierarchy: Select Top Module` を実行する。
6. Explorer の `HDL Hierarchy` に tree が出ることを確認する。
7. Tree node を click して該当 source line に移動することを確認する。

## Phase 4 変更履歴

更新日: 2026-07-09

### Auto Refresh

ファイル: `src/extension.ts`, `src/workspace/workspaceIndexer.ts`

TOP module 選択後、対象 source file の create/change/delete を `vscode.workspace.createFileSystemWatcher()` で監視する。`verilogHierarchy.autoRefresh` が `true` の場合、変更検出から 300 ms debounce して hierarchy を再構築する。

Watcher 対象:

- `verilogHierarchy.fileExtensions` から生成した glob。
- 既定値は `**/*.{v,sv,vh,svh}`。

制限:

- watcher は extension activation 時点の file extension 設定から作る。設定変更後に watcher pattern を反映するには Extension Development Host の再起動が必要。
- refresh は full rescan であり、incremental index はまだ実装していない。

### Parse Summary And Warnings

ファイル: `src/hierarchy/summary.ts`, `src/extension.ts`

refresh 完了時に Output channel `Verilog Hierarchy` へ summary を出す。

出力項目:

- refresh reason: `manual` または `auto`
- TOP module
- scanned file count
- indexed module count
- hierarchy node count
- unresolved node count
- cycle node count
- max hierarchy depth
- elapsed time

warning として以下を出力する。

- duplicate module definition と各定義位置。
- unresolved module と instance 宣言位置。
- cycle を検出して展開を止めた位置。

### Tree Item Display

ファイル: `src/views/hierarchyTreeProvider.ts`

Tree item の tooltip に module/instance、状態、source location を表示する。description は以下のいずれかになる。

- `unresolved`
- `cycle`
- `<N> child` / `<N> children`

### Phase 4 Tests

追加テスト:

- `summarizeHierarchy counts nodes, unresolved modules, cycles, and depth`
- `formatIndexWarnings lists duplicate definitions with locations`
- `formatHierarchyWarnings lists unresolved and cycle nodes`

Phase 4 完了時点の自動テスト結果:

```text
tests 10
pass 10
fail 0
```

## Phase 5 変更履歴

更新日: 2026-07-09

### Parser Upgrade Evaluation

ファイル: `docs/parser_evaluation.md`

SystemVerilog parser 候補として以下を評価した。

- tree-sitter-verilog
- slang
- Surelog
- Verible

判断:

- Phase 5 では external parser への置き換えは行わない。
- 現行の built-in lightweight parser を継続する。
- 次に parser 精度が必要になった場合、Verible JSON syntax tree adapter を第一候補、slang JSON AST adapter を第二候補として prototype する。
- Surelog は本格 elaboration/UHDM 連携が必要になるまで採用しない。

実装変更:

- runtime code の parser backend は変更していない。
- parser 評価メモを追加した。
- この実装仕様に Phase 5 の判断を追記した。

Phase 5 完了時点の自動テスト結果:

```text
tests 10
pass 10
fail 0
```

## 0.0.2 変更履歴

更新日: 2026-07-09

### Set As Top Module Context Command

ファイル: `package.json`, `src/extension.ts`

`HDL Hierarchy` の tree node 右クリックから `Verilog Hierarchy: Set as Top Module` を実行できるようにした。対象 node の `moduleName` を TOP として workspace を再 scan し、hierarchy を再解決する。

### Parser False Positive Hardening

ファイル: `src/hierarchy/parser.ts`, `test/hierarchy.test.ts`

`picorv32.v` で `if`, `for`, `case`, `assert`, `restrict property` などが module instance として誤検出される問題を修正した。

原因:

- 旧 parser は instance 宣言検出で module 名と instance 名の間の空白を必須にしていなかった。
- そのため `if(` を `moduleName=i`, `instanceName=f` のように単語分割して誤検出していた。

修正:

- parameterized instance と plain instance の検出 regex を分離した。
- plain instance では module 名と instance 名の間に空白を必須にした。
- `assert`, `assume`, `cover`, `restrict`, `reg`, `wire`, `logic`, `integer`, `parameter`, `localparam`, `genvar`, port direction などの HDL keyword を instance 除外対象に追加した。
- `if(foo)`, `for(...)`, `case(...)`, `assert(...)`, `assert property (...)`, `restrict property (...)` の回帰テストを追加した。

確認:

- `picorv32.v` の false positive は解消し、実インスタンスのみ検出されることを確認した。
- 自動テストは 12 件に増加した。
