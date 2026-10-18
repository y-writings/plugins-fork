# fork 固有の変更

このファイルには、`y-writings/plugins-fork` 固有の機能と利用方法を記載します。上流の説明は [README.md](./README.md) を参照してください。

## 変更方針

upstream 同期時の競合を減らすため、既存ファイルへの変更は動作・検証に必要な範囲に限定します。既存の README など、人間向けの説明文への変更は避けます。fork 固有のインストール方法や補足は、この `README.fork.md` にまとめます。

## pstack の Codex 対応

Claude Code 版と同様に、共通の `pstack/` から Codex 用の配布ツリーを生成します。

- 配布定義: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- Codex 用の生成物: [`harness/pstack/codex/`](./harness/pstack/codex/)
- ツール・モデル・保存先の読み替え: [Codex アダプター](./pstack/docs/harness/codex.md)

### インストール

Codex の `plugin` コマンドを利用できる環境で、この fork をチェックアウトし、リポジトリのルートから実行します。

```bash
codex plugin marketplace add .
codex plugin add pstack@plugins-fork
```

インストール後は新しい Codex セッションを開始し、モデル設定には `$pstack:setup-pstack`、通常の作業には `$pstack:poteto-mode` を使用します。

モデル設定は `~/.codex/pstack-models.md` に保存されます。`CODEX_HOME` を設定している場合は、そのディレクトリ内の `pstack-models.md` を使用します。pstack がアダプターを読み込む際に、この設定も読み込みます。

利用できない Cursor のモデル指定はセッションから継承するモデルに読み替えます。Cursor 固有の連携は実行できない旨を報告します。手動起動専用のスキルは Codex でも手動起動専用です。

### 再生成と検証

スキルやアダプターを変更したら、リポジトリのルートから生成物を更新します。生成物は直接編集しません。

```bash
node scripts/generate-pstack-harness-trees.mjs
```

検証には CI と同じ依存をインストールし、次を実行します。

```bash
npm install --no-save --package-lock=false ajv ajv-formats
node --test scripts/pstack-harness.test.mjs
node scripts/generate-pstack-harness-trees.mjs --check
node scripts/validate-plugins.mjs
node scripts/check-pstack-docs.mjs
```
