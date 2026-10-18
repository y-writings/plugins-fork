# AGENTS.md

このリポジトリは [cursor/plugins](https://github.com/cursor/plugins) の個人利用向け fork。上流の更新に追従しながら独自機能を維持する。

- この fork を skills.sh、SkillsMP などの外部ディレクトリや一般向け marketplace に登録・公開申請しない。一般向けの紹介・導入案内では upstream を案内し、元の作者・貢献者のクレジットを維持する。
- この fork に対して `skills` CLI（`npx skills` など）を実行する場合は、毎回 `DISABLE_TELEMETRY=1` を実行環境に渡し、利用情報の送信を無効にする。Codex の導入は `README.fork.md` のローカルカタログを使う手順に従う。
- `origin`: `https://github.com/y-writings/plugins-fork.git`。push・PR の宛先はこの fork。上流へ push・PR は送らない。
- `upstream`: `https://github.com/cursor/plugins.git`。更新の取得元。
- `main` は独自機能を含む利用版で、`origin/main` を追跡する。独自変更は `main` 起点の `feat/<name>` で開発し、`main` に統合する。上流との差分は小さく保つ。
- upstream 同期時の競合を減らすため、既存ファイルの変更は動作・検証に必要な最小限に限定する。説明だけの変更や無関係な整形は行わない。
- 既存の README など人間向けの文書は変更せず、fork 固有のインストール方法や補足はルートの [README.fork.md](./README.fork.md) に記載する。生成物に含まれる既存 README も、再生成によって不要な差分が生じないようにする。
- Git のローカル設定は `remote.pushDefault=origin`、`push.default=simple`、`pull.rebase=false`、`pull.ff=only`。`gh` の既定リポジトリもこの fork にする。
- 上流同期は両 remote を fetch し、`origin/main` に追従した `main` から `sync/upstream-YYYY-MM-DD` を作る。`upstream/main` を merge し、`main` へ `--ff-only` で反映、`origin/main` へ push 後に同期ブランチを削除する。
- 上流同期では rebase・squash・force push を使わず、履歴を維持する。競合は独自機能を保って解消する。
- 上流同期の追加の内容確認・動作検証は省略し、競合の有無と反映結果を確認する。
