# Verilog Hierarchy Viewer Development Plan

作成日: 2026-07-08

## 目的

Verilog HDL/SystemVerilog の既存ソースコードを VS Code 上で読み込み、ユーザーが TOP module を選択すると、その配下の module instance 階層をツリー表示する。各インスタンスノードを選択すると、該当インスタンス宣言のソース行へジャンプできるようにする。

この拡張機能の最初の価値は「大きな RTL の構造をすばやく把握し、定義位置へ戻れること」に置く。波形ビューア、合成、lint、完全な SystemVerilog elaboration は初期スコープに含めない。

## 参照した公式資料

- VS Code Extension API overview: https://code.visualstudio.com/api
- VS Code Tree View API: https://code.visualstudio.com/api/extension-guides/tree-view
- VS Code Your First Extension: https://code.visualstudio.com/api/get-started/your-first-extension
- VS Code Language Server Extension Guide: https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

## ユーザー体験

1. ユーザーが VS Code で RTL ワークスペースを開く。
2. コマンドパレットから `Verilog Hierarchy: Select Top Module` を実行する。
3. 拡張機能がワークスペース内の `.v`, `.sv`, `.vh`, `.svh` を走査し、検出した module 一覧を Quick Pick に表示する。
4. TOP module を選ぶと Side Bar の Tree View に階層を表示する。
5. ツリーの各ノードには `instance_name : module_name` を表示する。
6. ノードをクリックすると、インスタンス宣言行へジャンプする。module 定義ノードの場合は module 宣言行へジャンプする。
7. ファイル保存時、または refresh command 実行時に解析結果を更新する。

## MVP スコープ

MVP では「よくある RTL 構造を軽快に読める」ことを優先する。

- 対象言語: Verilog HDL と SystemVerilog の module 宣言、endmodule、module instantiation。
- 対象ファイル: VS Code workspace 内の `.v`, `.sv`, `.vh`, `.svh`。
- UI: Activity Bar ではなく Explorer か専用 View Container の Tree View。初期は実装量の少ない Explorer 配下でもよい。
- 操作: top module 選択、refresh、ノードクリックで該当行へジャンプ。
- 解析結果: module 定義位置、instance 名、instantiated module 名、instance 宣言位置、親子関係。
- 制限: preprocessor、generate、parameter override、interface、bind、configuration、package import の完全解決は MVP では保証しない。

## 非スコープ

- 完全な SystemVerilog コンパイラ相当の elaboration。
- macro 展開の完全互換。
- synthesis tool 固有の include path/define semantics の完全再現。
- schematic rendering。
- LSP による diagnostics/completion/hover。
- Marketplace 公開。

## 技術方針

### VS Code 拡張

TypeScript ベースの VS Code extension として開始する。公式の `Your First Extension` 相当の構成で土台を作り、UI は Tree View API を使う。Tree View API は `TreeDataProvider` で階層データを提供し、`TreeItem.command` または item selection command で `vscode.window.showTextDocument` と `Selection`/`Range` により該当行へ移動する。

推奨構成:

```text
src/
  extension.ts
  hierarchy/
    model.ts
    parser.ts
    indexer.ts
    resolver.ts
  views/
    hierarchyTreeProvider.ts
test/
  fixtures/
  parser.test.ts
  resolver.test.ts
```

### 解析器

初期実装は TypeScript 内の軽量 parser とする。ただし parser、indexer、resolver を VS Code API から分離し、将来 Language Server または外部 parser に移せる境界を保つ。

理由:

- MVP の目的は階層表示とジャンプであり、VS Code UI との結合が主な検証対象。
- 初期から Language Server にするとプロセス構成、通信、テスト対象が増え、MVP の学習コストが上がる。
- 解析ロジックを純粋関数寄りに分ければ、後から Language Server Extension Guide に沿って server/client 構成へ移行しやすい。

### parser の段階的精度

Phase 1 parser:

- line/block comment を除去する。
- module 宣言を検出する。
- module body 内の instance 宣言を検出する。
- parameter override `foo #(...) u_foo (...)` を許容する。
- arrayed instance `foo u_foo [N:0] (...)` は検出対象に含める。
- `generate/endgenerate` 内も単純な instance として拾う。
- macro 展開は行わず、macro が module 名や instance 名に絡む場合は unresolved とする。

Phase 2 parser:

- include path と `include` の解決。
- simple `define` 展開。
- package/interface/program/class を module と誤検出しない精度向上。
- multiple instances in one declaration の扱いを検討する。

Phase 3 parser:

- tree-sitter-verilog、Surelog、slang など既存 parser との連携を評価する。
- 大規模設計での性能、Windows での導入容易性、ライセンス、VS Code extension への同梱可否を比較する。

## データモデル案

```ts
type SourceLocation = {
  uri: string;
  line: number;
  character: number;
};

type ModuleDefinition = {
  name: string;
  declaration: SourceLocation;
  instances: ModuleInstance[];
};

type ModuleInstance = {
  moduleName: string;
  instanceName: string;
  declaration: SourceLocation;
  parameterized: boolean;
};

type HierarchyNode = {
  moduleName: string;
  instanceName?: string;
  declaration: SourceLocation;
  children: HierarchyNode[];
  unresolved?: boolean;
  cycle?: boolean;
};
```

## 階層解決

1. workspace の対象ファイルを `vscode.workspace.findFiles` で収集する。
2. 各ファイルを読み込み、module index を作る。
3. TOP module 選択後、module name から DFS で子 instance を展開する。
4. 同一 module 名が複数定義されている場合は warning を付け、最初に見つかった定義を使う。後で選択 UI を足す。
5. 未解決 module はツリーに `unresolved` として残し、クリック時は instance 宣言行へ移動する。
6. 再帰的インスタンスや cycle は `cycle` として打ち切る。

## UI 設計

Commands:

- `verilogHierarchy.selectTopModule`
- `verilogHierarchy.refresh`
- `verilogHierarchy.revealSource`

Views:

- `verilogHierarchy.view`: `HDL Hierarchy`

Tree node labels:

- root: `top_module`
- child: `u_name : child_module`
- unresolved child: `u_name : missing_module (unresolved)`
- cycle: `u_name : module_name (cycle)`

Context menu:

- `Reveal Source`
- `Set as Top Module`
- `Refresh`

Status/feedback:

- 初回解析中は progress notification。
- TOP module が未選択なら tree root に empty state を出す。
- parse errors は最初は output channel に記録し、ユーザー作業を止めない。

## 設定案

```json
{
  "verilogHierarchy.fileExtensions": [".v", ".sv", ".vh", ".svh"],
  "verilogHierarchy.exclude": ["**/node_modules/**", "**/.git/**", "**/out/**"],
  "verilogHierarchy.includePaths": [],
  "verilogHierarchy.defines": {},
  "verilogHierarchy.maxDepth": 100
}
```

## テスト方針

Unit tests:

- module 宣言検出。
- instance 宣言検出。
- parameter override 付き instance。
- comment 内の偽 module/instance を無視。
- unresolved module の保持。
- cycle 検出。

Integration tests:

- VS Code extension test runner で command が登録されること。
- fixture workspace から TOP module を選び、TreeDataProvider が期待ノードを返すこと。
- reveal command が正しい URI/line を開くこと。

Fixture examples:

- single file simple hierarchy。
- multi file hierarchy。
- generate block を含む階層。
- parameterized module。
- duplicate module definition。
- intentionally unresolved child。

## 開発フェーズ

### Phase 0: リポジトリ準備

- この計画書を作成する。
- README と `.gitignore` を用意する。
- 次フェーズで `yo code` または手作業で TypeScript extension skeleton を作る。

完了条件:

- git repository と計画書が存在する。

### Phase 1: Extension skeleton

- TypeScript VS Code extension の最小構成を作る。
- `Select Top Module` と `Refresh` command を登録する。
- 空の Tree View を表示する。
- extension host で起動できることを確認する。

完了条件:

- F5 で Extension Development Host が起動する。
- Command Palette に command が出る。
- Tree View が表示される。

### Phase 2: Parser MVP

- parser/indexer/resolver の純粋ロジックを作る。
- fixture と unit test を追加する。
- simple hierarchy を解決する。

完了条件:

- `top -> child -> grandchild` が fixture から解決できる。
- unresolved/cycle の最低限の扱いがテスト済み。

### Phase 3: Tree integration

- Quick Pick で TOP module を選択する。
- TreeDataProvider で階層を表示する。
- ノード click で instance declaration line へジャンプする。

完了条件:

- 実 RTL workspace で TOP 選択、ツリー表示、ジャンプができる。

### Phase 4: Usability hardening

- refresh、file watcher、settings を追加する。
- output channel に parse summary/warnings を出す。
- duplicate definitions、unresolved modules を見やすく表示する。
- 大きめの workspace で性能を測る。

完了条件:

- 数百ファイル規模で操作が数秒以内に収まる。
- 解析失敗が UI 全体を壊さない。

### Phase 5: Parser upgrade evaluation

- tree-sitter-verilog、slang、Surelog などの採用可能性を比較する。
- Windows/VS Code extension への導入負荷を評価する。
- 軽量 parser 継続か外部 parser 連携かを判断する。

完了条件:

- parser 技術選定メモを残し、次の精度改善の道筋が決まる。

## リスクと対策

- SystemVerilog 構文が広い: MVP の対応範囲を明記し、誤検出しやすい構文を fixture 化して少しずつ潰す。
- macro/include が多い設計で階層が欠ける: unresolved node を消さずに表示し、includePaths/defines 設定を後続で追加する。
- 大規模 workspace で遅い: file watcher と incremental index を Phase 4 で導入する。最初は手動 refresh でもよい。
- 同名 module が複数存在する: warning と後続の選択 UI で扱う。
- VS Code API の変更: 公式 docs と release notes を確認し、安定 API の範囲で実装する。

## 最初の実装タスク候補

1. `package.json`, `tsconfig.json`, `src/extension.ts` を追加する。
2. `verilogHierarchy.refresh` command と output channel を実装する。
3. `src/hierarchy/model.ts` を作る。
4. fixture `test/fixtures/simple_top/` を作る。
5. `parseModules(text, uri)` の unit test を先に書く。
6. Tree View の空状態を表示する。

## 判断メモ

最初から Language Server にしない。解析器は VS Code 非依存の TypeScript module として作り、将来的な LSP 化に備える。今回必要な主機能は workspace scan、tree display、source reveal であり、Tree View API と command API だけで MVP を構成できる。

