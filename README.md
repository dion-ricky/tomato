# Tomato 🍅

A modified Pomodoro timer — the work blocks get shorter, the breaks stay the same.

## The cycle

```text
Work 50 → Break 10 → Work 40 → Break 10 → Work 30 → Break 10
→ Work 20 → Break 10 → Work 10 → Break 10 → repeat from the top
```

## Features

- Pure static site: plain HTML/CSS/JS, **zero backend, zero dependencies**
- Timestamp-based timing (stays accurate even when the tab is throttled)
- Cycle ladder visual showing where you are
- Progress bar, cycle/session counter
- Chime + optional desktop notifications at each phase switch
- State persisted in `localStorage` — a refresh won't lose your spot
- Auto light/dark theme

## Run locally

Just open `index.html` in a browser, or serve the folder:

```sh
npx serve .   # or: python3 -m http.server
```

## Deploy to GitHub Pages

1. Create a GitHub repo (e.g. `tomato`)
2. Push this folder's contents to the repo root:

   ```sh
   git init && git add -A && git commit -m "Tomato"
   git remote add origin git@github.com:<you>/tomato.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root → Save**
4. Your site is live at `https://<you>.github.io/tomato/` within a minute or two.
