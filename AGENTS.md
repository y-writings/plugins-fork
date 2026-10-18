# AGENTS.md

このリポジトリは [cursor/plugins](https://github.com/cursor/plugins) の個人利用向け fork。上流の更新に追従しながら独自機能を維持する。

- `origin`: `https://github.com/y-writings/plugins-fork.git`。push・PR の宛先はこの fork。上流へ push・PR は送らない。
- `upstream`: `https://github.com/cursor/plugins.git`。更新の取得元。
- `main` は独自機能を含む利用版で、`origin/main` を追跡する。独自変更は `main` 起点の `feat/<name>` で開発し、`main` に統合する。上流との差分は小さく保つ。
- Git のローカル設定は `remote.pushDefault=origin`、`push.default=simple`、`pull.rebase=false`、`pull.ff=only`。`gh` の既定リポジトリもこの fork にする。
- ローカルでの上流同期は両 remote を fetch し、`origin/main` に追従した `main` から `sync/upstream-YYYY-MM-DD` を作る。`upstream/main` を merge し、`main` へ `--ff-only` で反映、`origin/main` へ push 後に同期ブランチを削除する。
- GitHub の `main` で `Sync fork → Update branch` を使ってもよい。`ahead` のみなら同期不要。独自コミットを破棄する操作は選ばない。同期後は `git switch main` → `git pull --ff-only origin main` → `git fetch upstream` でローカルへ反映する。
- 上流同期では rebase・squash・force push を使わず、履歴を維持する。競合は独自機能を保って解消する。
- 上流同期の追加の内容確認・動作検証は省略し、競合の有無と反映結果を確認する。
