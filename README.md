# City Exploration Quest

Standalone, static, mobile-first quest app. No backend and no build step. Progress is kept in `localStorage`.

- `index.html`: the player app (Ukrainian by default, English switch). Opens a quest from the `questId` URL parameter, e.g. `index.html?questId=placeholder-quest`.
- `editor.html`: the quest editor. Open it with `?questId=<id>` to edit that quest. Open it locally by double-clicking, or serve the folder.
- `data/quests/<id>.js`: the obfuscated data of quest `<id>` (currently the placeholder `placeholder-quest`).
- `data/quests/<id>.source.json`: the plaintext source of that quest, with the answers. It is gitignored and never committed, because Pages would publish it. Only `placeholder-quest.source.json` is tracked, as an example.
- `js/shared/quest-loader.js`: loads `data/quests/<id>.js` for the `questId` in the URL.

Several quests can be deployed side by side. Each one is a pair of files in `data/quests/`, and players reach it with its own `questId` link.

Quest ids may contain only Latin letters, digits, `-` and `_`. Anything else is rejected before any file is requested, which prevents path traversal. The id must also match the file name and the `id` inside the file.

## Adding or editing a quest

1. Open `editor.html?questId=<id>` from a local copy of the repo. For a new quest, use a new id, e.g. `editor.html?questId=my-new-quest`.
2. Add, remove or reorder stations. Edit prompts, hints (2-3), accepted location names and coordinates. Use "Use my current location" while standing at the spot.
3. Click **Export quest file (.js)** and save the downloaded file as `data/quests/<id>.js`. Also click **Export source JSON** and keep the file outside the repo, e.g. in a private folder. Do not save it in `data/quests/`, because `git add` would not commit it and it would not be deployed. You can re-import it later with "Import source JSON".
4. Commit and push to `main` to redeploy. Players open `index.html?questId=<id>`.

The editor keeps an autosaved draft per quest in the browser. After you replace a quest file by hand, use "Discard draft and reload file" to drop a stale draft.

Changing the quest `id` resets the saved progress of players, because it is part of the storage key. It is also the obfuscation key.

## Deploying to GitHub Pages

Enable **Settings > Pages > Source: GitHub Actions**. `.github/workflows/pages.yml` publishes the repo root on every push to `main`. Use HTTPS (GitHub Pages does this) or browsers will refuse geolocation.

Everything committed is public after deploy, so never commit a quest source file. `.gitignore` excludes `data/quests/*.source.json` except the placeholder. Check with `git status --ignored` before pushing.

## Notes

- Tasks, hints, answers and coordinates are stored base64 + XOR obfuscated and decoded only when needed. This stops casual peeking, but it is not real security. The XOR key is the quest id, which is public in the URL and file name, so anyone can decode `data/quests/<id>.js`. Hiding the plaintext source only prevents an easy copy.
- Media upload to the quest chat is out of scope and handled outside the app.
- If location is denied or unavailable, the player can retry, check in as "unverified" (configurable penalty), or switch to no-travel mode.
- Checks: `node tools/test.js`. Regenerate placeholders: `node tools/build-placeholder.js`.
- Local preview: `python -m http.server` (or open `index.html?questId=placeholder-quest` directly; geolocation may not work on `file://`).
