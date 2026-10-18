# fork 固有の変更

このファイルには、`y-writings/plugins-fork` 固有の機能と利用方法を記載します。上流の説明は [README.md](./README.md) を参照してください。

## 外部ディレクトリへの掲載方針

このリポジトリは個人利用のための非公式 fork です。skills.sh、SkillsMP などのスキル・プラグイン配布サイトや一般向け marketplace への掲載・登録を希望しません。この fork から登録・公開申請も行いません。

poteto さんと Cursor チームをはじめ、元の作者・貢献者に敬意を払い、原著者の表記とライセンスを維持します。一般向けの紹介・導入案内には [cursor/plugins](https://github.com/cursor/plugins) と [upstream の pstack](https://github.com/cursor/plugins/tree/main/pstack) をご利用ください。

> This is an unofficial fork for personal use. Please do not index or list this repository in skill/plugin directories or marketplaces. Direct users to the upstream project instead.

これは掲載を希望しない意思表示です。公開リポジトリを第三者が収集することを技術的に防ぐ設定ではありません。

skills.sh は [skills CLI の利用情報をもとに自動掲載](https://www.skills.sh/docs/faq)します。この fork に対して `skills` CLI（`npx skills` など）を使う場合は、コマンドを実行するシェルで事前に次を設定してください。

```bash
export DISABLE_TELEMETRY=1
```

[この設定](https://www.skills.sh/docs/cli)は、そのシェルから起動する skills CLI の利用情報送信を無効にします。別のシェルでは再設定が必要です。Codex への導入は、下記のローカルカタログを使う手順に従ってください。

## 変更方針

upstream 同期時の競合を減らすため、既存ファイルへの変更は動作・検証に必要な範囲に限定します。既存の README など、人間向けの説明文への変更は避けます。fork 固有のインストール方法や補足は、この `README.fork.md` にまとめます。

## pstack の Codex 対応

共通の `pstack/` から、fork 専用のスクリプトで Codex 用の配布ツリーを生成します。上流の既存スクリプトと GitHub ワークフローは変更しません。

- 配布定義: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- Codex 用の生成物: [`harness/codex/pstack/`](./harness/codex/pstack/)
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

上流の生成処理は `harness/pstack/`、Codex 用の生成処理は `harness/codex/pstack/` を更新します。それぞれ相手の生成物には触れません。

```bash
node scripts/generate-pstack-harness-trees.mjs
node scripts/generate-pstack-codex.mjs
```

fork 専用の [Codex 検証 workflow](./.github/workflows/validate-codex-plugins.yml) は、関連ファイルを変更した PR と `main` への push で、ハーネステスト・Codex 生成物チェック・Codex カタログ検証を実行します。

手元で検証するには CI と同じ依存をインストールし、次を実行します。

```bash
npm install --no-save --package-lock=false ajv ajv-formats
node --test scripts/pstack-harness.test.mjs
node scripts/generate-pstack-harness-trees.mjs --check
node scripts/generate-pstack-codex.mjs --check
node scripts/validate-plugins.mjs
node scripts/validate-codex-plugins.mjs
node scripts/check-pstack-docs.mjs
```
