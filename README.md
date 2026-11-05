# City Exploration Quest

Standalone, static, mobile-first quest app. No backend and no build step. Progress is kept in `localStorage`.

- `index.html`: the player app (Ukrainian by default, English switch).
- `editor.html`: the quest editor. Open it locally by double-clicking, or serve the folder.
- `data/quest.js`: the obfuscated quest data (currently placeholders).
- `data/quest-source.json`: the plaintext source for the placeholders. Replace it with your own backup exported from the editor.

## Editing the quest

1. Open `editor.html` from a local copy of the repo.
2. Add, remove or reorder stations. Edit prompts, hints (2-3), accepted location names and coordinates. Use "Use my current location" while standing at the spot.
3. Click **Export quest.js** and replace `data/quest.js` with the downloaded file. Also click **Export source JSON** and keep it as a backup. You can re-import it later.
4. Commit and push to `main` to redeploy.

The editor keeps an autosaved draft in the browser. After you replace `data/quest.js` by hand, use "Reload from data/quest.js" to drop a stale draft.

Changing the quest `id` resets the saved progress of players, because it is part of the storage key. It is also the obfuscation key.

## Deploying to GitHub Pages

Enable **Settings > Pages > Source: GitHub Actions**. `.github/workflows/pages.yml` publishes the repo root on every push to `main`. Use HTTPS (GitHub Pages does this) or browsers will refuse geolocation.

## Notes

- Tasks, hints, answers and coordinates are stored base64 + XOR obfuscated and decoded only when needed. This stops casual peeking, but it is not real security.
- Media upload to the quest chat is out of scope and handled outside the app.
- If location is denied or unavailable, the player can retry, check in as "unverified" (configurable penalty), or switch to no-travel mode.
- Checks: `node tools/test.js`. Regenerate placeholders: `node tools/build-placeholder.js`.
- Local preview: `python -m http.server` (or open `index.html` directly; geolocation may not work on `file://`).
