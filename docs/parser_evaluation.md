# Parser Upgrade Evaluation

作成日: 2026-07-09

## 結論

Phase 5 では外部 parser への置き換えは行わず、現行の built-in lightweight parser を継続する。

理由:

- 現在の主機能は module hierarchy 表示と source jump であり、Phase 4 までの実装で MVP の実用性は確認できている。
- 外部 parser を同梱すると、Windows 配布、binary 管理、VS Code Marketplace package size、ユーザー設定、ライセンス確認、failure handling が一気に増える。
- parser は `src/hierarchy/parser.ts`, `indexer.ts`, `resolver.ts` に分離済みで、後から external backend を追加しやすい。
- 次に精度改善が必要になった場合は、Verible か slang のどちらかを先に prototype するのがよい。

## 評価対象

### tree-sitter-verilog

Source:

- https://github.com/tree-sitter/tree-sitter-verilog

確認内容:

- SystemVerilog grammar for tree-sitter。
- npm install が案内されている。
- MIT license。

良い点:

- JavaScript/Node.js extension との親和性が高い。
- concrete syntax tree を得る用途に向く。
- incremental parsing を将来検討しやすい。

懸念:

- module hierarchy 解決には syntax tree traversal と SystemVerilog 構文対応の設計が必要。
- preprocessor/include/elaboration は別途扱う必要がある。
- native binding または WASM 周りの packaging 検証が必要。

判断:

- VS Code extension 内に組み込む parser としては最も軽そう。
- ただし hierarchy 精度改善の即効性は Verible/slang より低い可能性がある。

### slang

Source:

- https://github.com/MikePopoloski/slang

確認内容:

- SystemVerilog compiler and language services。
- lexing, parsing, type checking, elaborating SystemVerilog code を提供。
- executable tool、JSON AST dump、Python bindings、language server 用途が挙げられている。
- Linux/macOS/Windows の pre-built binaries が案内されている。
- MIT license。

良い点:

- SystemVerilog frontend として強く、elaboration まで視野に入る。
- editor language service で壊れたコードにも強い設計が明記されている。
- 将来 TOP hierarchy の精度を上げるには有力。

懸念:

- VS Code extension に直接同梱するには binary 配布と platform 対応の設計が必要。
- AST JSON から module instance hierarchy を抽出する adapter の調査が必要。
- ユーザー project の include path/define 設定 UI が必要になる。

判断:

- 長期的には最有力候補。
- Phase 6 以降で `slang` executable を user-provided path または bundled optional binary として試す価値がある。

### Surelog

Source:

- https://github.com/chipsalliance/Surelog

確認内容:

- SystemVerilog 2017 preprocessor, parser, elaborator, UHDM compiler。
- C/C++ VPI、Python AST API、UHDM API がある。
- Linux gcc、Windows msys2-gcc/msvc、macOS で compile 可能。
- Apache-2.0 license。

良い点:

- preprocessor/elaborator/UHDM まで含む本格 frontend。
- 大規模 design flow への接続力が高い。

懸念:

- extension の軽量な hierarchy viewer としては導入コストが大きい。
- build/runtime dependency が重い。
- UHDM や serialized model から必要な hierarchy 情報だけ抜く adapter が必要。

判断:

- 本格 EDA flow 連携を目指す段階までは採用しない。
- 現時点では過剰。

### Verible

Source:

- https://github.com/chipsalliance/verible

確認内容:

- SystemVerilog developer tools suite。
- parser, style-linter, formatter, language server を含む。
- standalone `verible-verilog-syntax` が syntax tree を JSON export できる。
- Linux/Windows binary releases が案内されている。

良い点:

- developer tool 用途に近く、VS Code extension から external command として呼びやすい。
- JSON syntax tree export があるため adapter prototype がしやすい。
- language server も含むため、将来の LSP 化と相性が良い。

懸念:

- syntax tree から hierarchy を作る adapter 実装が必要。
- include/define/elaboration の扱いは別途確認が必要。
- binary path 設定と version compatibility の管理が必要。

判断:

- Phase 6 prototype の第一候補。
- `verible-verilog-syntax --export_json` 相当を使い、module declarations と instantiations を抽出できるか検証する。

## 採用方針

Phase 5 時点:

- 実装は built-in parser 継続。
- external parser は入れない。
- `docs/implementation_spec.md` に Phase 5 の判断を追記する。

次の parser 改善候補:

1. Verible JSON syntax tree adapter prototype。
2. slang JSON AST adapter prototype。
3. tree-sitter-verilog の Node/WASM packaging 検証。
4. Surelog/UHDM は本格 elaboration が必要になった段階で再評価。

## Phase 6 以降の実装案

外部 parser を入れる場合、既存構成を保ったまま以下の境界を追加する。

```text
src/hierarchy/
  parser.ts              # current built-in parser
  parserBackend.ts       # backend selection
  external/
    veribleAdapter.ts
    slangAdapter.ts
```

設定案:

```json
{
  "verilogHierarchy.parserBackend": "builtin",
  "verilogHierarchy.externalParserPath": "",
  "verilogHierarchy.includePaths": [],
  "verilogHierarchy.defines": {}
}
```

adapter の責務:

- source file から `ModuleDefinition[]` を返す。
- VS Code extension 側へ external tool の詳細を漏らさない。
- external parser が失敗した場合は Output channel に warning を出し、可能なら built-in parser に fallback する。

