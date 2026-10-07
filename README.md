# 🎛️ Big Boss Command Centre — Tech House

A production-ready, minimalist control room for **Big Boss** to monitor and control the Tech House in real time:
contestants, tasks, points, captaincy, nominations, immunity, the Danger Zone, announcements, a task timer,
live statistics and evictions — all in one screen, with zero dependencies at runtime.

> **Team:** Spartans · **Season:** 1 · **Stack:** vanilla ES modules + a zero-dependency Node static server.

---

## 🚀 Run it

```bash
npm start            # → http://localhost:5173
```

The app is a static bundle — any static host works (`python3 -m http.server`, Netlify, Vercel, GitHub Pages…).

```bash
npm test             # 20 automated feature checks (headless jsdom + esbuild)
npm run check        # syntax-check every shipped file
```

---

## ✅ Mandatory deliverables — where to find them

| # | Feature | Where it lives | How it works |
|---|---------|----------------|--------------|
| 1 | **Contestant Management** | `Contestants` view | 12 seeded contestants (8+ required) with name, team (Alpha/Bravo/Charlie/Delta), points and status (active / nominated / immune / evicted). Add, edit and delete contestants; filter by status, team and search. |
| 2 | **Live Leaderboard** | `Leaderboard` view + Overview | Rankings recompute on every point change, with FLIP row animations, rank flashes, per-contestant score bars and a top-3 podium. |
| 3 | **Task Management** | `Tasks` view | Assign tasks (title, description, points, multi-assignee), move them pending → in progress → completed / failed, reopen or delete. Completed tasks pay points to every assignee automatically. |
| 4 | **Point System** | Everywhere | Quick **−10 / +5 / +10 / +25** buttons on each contestant card and leaderboard row, plus a custom modal with any delta and a reason. Points can never go negative and evicted contestants cannot be scored. |
| 5 | **Captaincy** | Overview · Contestants | Appoint, transfer or revoke the House Captain. The Captain is highlighted across the UI (sidebar card, badges) and **cannot be nominated** while in office. |
| 6 | **Nominations** | `Nominations` view | Nominate one or many contestants with an optional reason, in numbered rounds. Duplicate nominations, captain nominations and self-nominations are rejected with a toast. |
| 7 | **Immunity** | `Nominations` · Contestants | Grant / revoke immunity. Immune contestants are **hard-blocked from nomination** (button disabled + server-side guard) and any existing nomination is automatically revoked when immunity is granted. |
| 8 | **Danger Zone** | `Nominations` · Overview | A dedicated, always-visible list of every nominated contestant in the current round, with withdraw and evict actions, a live count badge in the sidebar and an at-a-glance warning ticker. |
| 9 | **Big Boss Announcements** | `Announcements` view + header | Compose a message with a tone (highlight / info / warning / good news) and broadcast it — a full-screen "Big Boss" overlay takes over the House instantly and every message is archived with a replay button. |
| 10 | **Task Timer** | `Tasks` · Overview | Countdown ring with start, pause and reset, quick presets (01:00 → 15:00), custom durations and a live label. Turns red and pulses under 30 seconds, fires a "TIME UP" announcement at zero, and keeps counting accurately across tab throttling and reloads (timestamp-based). |
| 11 | **House Statistics** | Overview · Contestants | Live stats: highest scorer (MVP), most tasks completed, leading team, house points/average, task completion rate, immunity count, nominee count, eviction count and per-team standings. |
| 12 | **Eviction** | `Evictions` view | Evict from the Danger Zone, from a contestant card, or evict the whole round at once. Evicted contestants leave the leaderboard and task assignments, keep their historical record, and can be reinstated. Evicting an immune contestant requires an explicit Big Boss override, which is recorded in the log. |

---

## 🧠 Design decisions

- **Minimalist, dark, information-dense UI.** A single accent colour, tabular numerals, no decorative chrome — every pixel carries state (gold = captain, green = immunity, red = danger, blue = team).
- **Real-time feel.** State changes re-render only the active view; the timer ticker patches just the clocks/rings/chips, so the countdown never stutters the UI. Leaderboard reordering uses the FLIP technique with up/down flash animation.
- **Single source of truth.** `js/store.js` owns all state, validation and audit logging; `js/app.js` is pure rendering + event delegation; `js/icons.js` holds the inline SVG icon set. No framework, no build step required to run.
- **Safe by construction.** Every mutation validates its preconditions and throws human-readable errors that surface as toasts (e.g. *"Zara Khan is IMMUNE and cannot be nominated."*). Destructive actions require confirmation; all user text is HTML-escaped.
- **Persistence.** The whole House is serialised to `localStorage` on every change, with a versioned key, forward-compatible defaults, plus JSON export/import for backups and season resets.
- **Keyboard-first.** `1–9` switch views, `N` composes an announcement, `T` starts/pauses the timer, `Esc` closes overlays, `Enter` confirms modals.

## 🗂️ Project structure

```
index.html          App shell, navigation, overlays
styles.css          Design system (tokens, components, responsive, reduced-motion)
js/store.js         State, validation, audit log, stats, persistence
js/app.js           Views, rendering, modals, announcements, event wiring
js/icons.js         Inline SVG icon set
server.cjs          Zero-dependency production static server (gzip, ETag, SPA fallback)
test/smoke.mjs      20 headless feature checks mapped to the deliverable checklist
```

## 🔌 Production notes

- `server.cjs` serves on `0.0.0.0`, gzips compressible assets, sets `ETag`/`Cache-Control`, blocks path traversal and falls back to `index.html` for unknown routes.
- The app is a fully static bundle, so it also deploys to any CDN/host with no server-side requirements.
- Accessibility: semantic landmarks, `aria-live` regions for announcements and toasts, visible focus rings, and `prefers-reduced-motion` support.

## 👥 Team

Built by **Spartans** for the Tech House. Big Boss is watching. 🫡
