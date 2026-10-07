# 🎛️ BIG BOSS · COMMAND CENTER — Tech House

A production-grade, **surveillance-control-room** dashboard that lets Big Boss monitor and control the Tech House
in real time: contestants, live leaderboard, tasks, points, captaincy, nominations, immunity, the Danger Zone,
cinematic announcements, the task timer, house statistics and evictions.

Brand: **SPARTANS X TECH BOSS** · dark glassmorphism UI · animated 3D background (Three.js) · centralized reducer
state · zero runtime dependencies beyond a self-hosted vendor bundle.

**🔴 Live app:** **[command-centre-byspartans.onrender.com](https://command-centre-byspartans.onrender.com/)** — deployed on Render as a
Web Service (free plan: the first request after idling takes ~30 s to wake the instance).

```
npm install
npm start        # → http://localhost:5173
npm test         # 32 automated feature checks (headless jsdom + esbuild)
```

**Deploy to Render in one click:** this repo ships a `render.yaml` blueprint (Web Service,
`/healthz` health check, immutable caching, no database). The reference deployment lives at
**https://command-centre-byspartans.onrender.com/**. Full walkthrough, alternatives and
verification commands: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

---

## 1. Design decisions

| Decision | Why |
|---|---|
| **Control-room art direction** — near-black navy (`#05070d → #0b1020`), electric cyan `#22d3ee` primary, violet `#8b5cf6` secondary, crimson `#ef4444` danger, amber `#f59e0b` warning, emerald `#10b981` success, gold `#facc15` captain | Colour carries meaning, so the House can be read at a glance. Each tone is always paired with an icon + label (never colour alone). |
| **Glass surfaces on a 3D room** | `backdrop-filter` cards over a wireframe grid floor, drifting node network and a slow "eye" motif give depth without stealing attention. Vignette + scanlines + grain sell the surveillance fantasy. |
| **Three.js, tree-shaken and self-hosted** | `js/background-scene.js` → `vendor/background.bundle.js` (527 KB minified / 135 KB gzip, no CDN, works offline). DPR capped at 2, particle counts reduced on mobile, animation pauses on `visibilitychange`, and the whole scene is replaced by a static gradient under `prefers-reduced-motion` or without WebGL. |
| **Components emit markup, one action layer mutates state** | Views are pure `state → HTML` renderers. Every control is `data-action="namespace:verb"` and handled in `js/actions.js`, so behaviour is greppable and never duplicated. |
| **Pure reducer as the only writer** | `js/store/reducer.js` returns new state, validates House rules and throws human-readable errors (*"Meera Nair holds immunity — nomination denied."*). The UI turns those into toasts. |
| **Progressive motion** | FLIP reordering with success/danger flashes, count-up scores (with a settle timer so a throttled tab still shows the truth), staggered card entrances, ghost-glitch removal + full-screen scanline flash on eviction, and a cinematic typewriter banner for announcements. Everything collapses under `prefers-reduced-motion`. |
| **One primary action per card** | Points stepper or Reinstate is always the primary button; captaincy, immunity, nomination, edit and eviction live behind the ⋯ menu. Destructive actions always confirm in a modal. |
| **Brand layer, not status layer** | The official *SPARTANS X TECH BOSS* key art carries gold + crimson as **identity** (hero, splash, sidebar crest, banner, favicon) while data keeps its cyan/violet semantics — so the logo never competes with, or contradicts, a status colour. |
| **Truthful DOM** | Numbers render their real value into the markup and are then animated, so the UI is correct even before/without JavaScript animation, and it is testable. |

## 2. Folder structure

```
.
├── index.html                     # shell: background stack, app frame, overlays
├── server.cjs                     # zero-dependency static server (gzip, ETag, SPA fallback)
├── package.json                   # scripts: start · test · check · build:vendor
│
├── styles/
│   ├── tokens.css                 # palette, 8px spacing, radii, type scale, motion vars, @font-face
│   ├── base.css                   # reset, background layers, focus rings, utilities
│   ├── layout.css                 # app shell, top bar, sidebar/tab-bar, bento + grids, breakpoints
│   ├── components.css             # glass, buttons, badges, cards, leaderboard, timer, overlays
│   └── animations.css             # keyframes, stagger, FLIP flashes, glitch-out, reduced-motion
│
├── js/
│   ├── main.js                    # bootstrap: render cycle, timer loop, shortcuts, filters, background
│   ├── actions.js                 # every data-action handler (single mutation surface)
│   ├── motion.js                  # FLIP, count-up, ghost removal, glitch flash
│   ├── icons.js                   # inline SVG icon set
│   ├── background-scene.js        # Three.js scene (source for the vendor bundle)
│   ├── store/
│   │   ├── index.js               # observable store + localStorage persistence
│   │   ├── reducer.js             # pure reducer, House rules, audit log
│   │   ├── selectors.js           # derived data (leaderboard, danger zone, stats…)
│   │   └── seed.js                # demo season (12 contestants, 3 tasks, 1 broadcast)
│   ├── ui/
│   │   ├── modal.js               # focus-trapped dialog + confirm helper
│   │   ├── toast.js               # success / error / blocked notifications
│   │   ├── banner.js              # cinematic Big Boss takeover (typewriter + progress)
│   │   └── menu.js                # one-at-a-time action menus
│   ├── components/                # Avatar · Badge · StatCard · Leaderboard · ContestantCard
│   │                              # TaskPanel · TimerRing · DangerZone · ActivityFeed
│   │                              # AnnouncementList · Header · Sidebar · HouseStats · ModalForms
│   └── views/                     # Dashboard · Contestants · Tasks · Nominations · Leaderboard
│                                  # Announcements · Evictions · Activity · Settings
│
├── assets/
│   ├── brand/                     # SPARTANS X TECH BOSS crest + key art (see its README)
│   └── icons/                     # favicon.ico · icon-192/512 · maskable · og-image
├── favicon.ico                    # root copy so /favicon.ico always resolves
├── site.webmanifest               # PWA manifest (app icons, shortcuts, theme)
├── render.yaml                    # Render blueprint (Web Service + health check)
├── docs/DEPLOY.md                 # Render deployment guide + verification commands
├── scripts/sync-logo.mjs          # npm run brand:logo -- master.png  → all art + icons
│
├── vendor/
│   ├── background.bundle.js       # generated: npm run build:vendor
│   └── fonts/                     # self-hosted Orbitron + Inter (woff2)
│
├── test/smoke.mjs                 # 28 headless feature checks
└── docs/dashboard-layout.svg      # hand-drawn layout schematic
```

## 3. Brand — SPARTANS X TECH BOSS

The crew logo lives in `assets/brand/` and appears in five places: the **boot splash**, the **sidebar crest +
wordmark**, the **dashboard hero** (key art with season lockup, live status and the three fastest Big Boss
actions), the **announcement banner**, and the **favicon / apple-touch-icon**.

```bash
npm run brand:logo -- ~/Downloads/my-logo.jpg   # swap in your own artwork → regenerates every size
```

Derivatives are produced from one full-resolution master (`logo-source.jpg`, 1536×1024) by `scripts/sync-logo.mjs`
(ImageMagick `convert`): 256²/512² crest, 720×480 + 1280×853 key art, 640² square icon **and the icon set** —
`favicon.ico` (16/32/48), `favicon-48.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (safe-zone
padded) and the 1200×630 `og-image.jpg` social card. All crops are forced square, so an odd master aspect ratio
can never squash an icon. See `assets/brand/README.md` for the crop knobs.

### Icon map

| Icon | Where it is used |
|---|---|
| `favicon.ico` (root) | Legacy + default browser requests — always resolves, never falls back to HTML |
| `assets/icons/favicon-48.png` | Modern browsers (48 px) |
| `assets/icons/icon-192.png` | Android home screen, apple-touch-icon |
| `assets/icons/icon-512.png` | PWA install prompt |
| `assets/icons/icon-maskable-512.png` | Android adaptive/maskable launcher icon |
| `assets/icons/og-image.jpg` | `og:image` + `twitter:image` link previews |
| `assets/brand/logo-mark.png` | In-app crest: sidebar, hero, announcement banner |

Declared in `index.html` (`<link rel="icon">`, `apple-touch-icon`, `mask-icon`, `manifest`) and
`site.webmanifest` (name, theme colour `#05070d`, standalone display, four app shortcuts).

## 4. Screenshots

**Live app:** <https://command-centre-byspartans.onrender.com/> — open it to see every view (loading a fresh
browser profile shows the seeded season, so screenshots are reproducible).

`docs/dashboard-layout.svg` is a **hand-drawn layout schematic** (not a screenshot) of the dashboard bento grid.

To capture real screenshots for a submission, run the app and save PNGs into `docs/screenshots/`:

| Suggested file | View | What to capture |
|---|---|---|
| `00-splash.png` | Boot | SPARTANS X TECH BOSS splash while the feed establishes |
| `01-dashboard.png` | Dashboard | Brand hero + stats row + leaderboard + timer + Danger Zone |
| `02-contestants.png` | Contestants | Filter bar, roster grid, action menu open |
| `03-tasks.png` | Tasks | Task timer running, task board with a completion |
| `04-nominations.png` | Nominations | Danger Zone alarm card + immunity panel |
| `05-announcement.png` | Any | The cinematic Big Boss banner mid-typewriter |
| `06-eviction.png` | Evictions | Eviction record with a reinstated contestant |

## 5. Feature checklist — the 12 mandatory features

| # | Feature | Where | How to verify |
|---|---|---|---|
| 1 | **Contestant management** (8+ with name, team, points, status) | Contestants view | 12 seeded contestants; add/edit/delete; search + team + status filters; roster table |
| 2 | **Live leaderboard** | Leaderboard view + dashboard | Instant re-ranking with FLIP animation, medals for the top 3, FLIP keys on every row |
| 3 | **Task management** | Tasks view | Assign multi-contestant tasks, pending → in progress → completed / failed, reopen, delete |
| 4 | **Point system** | Everywhere | ±10 quick buttons, +5/+25 stepper on cards, custom modal with reason, clamped at 0, full audit log |
| 5 | **Captaincy** | Nominations view · card menu | Appoint / transfer / revoke — exactly one Captain at a time (enforced in the reducer) |
| 6 | **Nominations** | Nominations view | Multi-select with reason, rounds; duplicates and self-votes rejected |
| 7 | **Immunity** | Nominations view · card menu | Immune contestants show a blocked *"Immunity active — nomination denied"* toast; existing nominations auto-revoke |
| 8 | **Danger Zone** | Nominations view + dashboard | Crimson alarm card with pulsing border, all nominees listed, sidebar badge, withdraw/evict actions |
| 9 | **Big Boss announcements** | Announcements view + header | Cinematic full-screen banner (pulsing eye, typewriter, progress bar, auto-dismiss), archive + replay |
| 10 | **Task timer** | Tasks view + dashboard | Circular ring: start / pause / reset, presets, custom duration + label, amber < 30 s, pulsing crimson < 10 s, TIME-UP broadcast |
| 11 | **House statistics** | Dashboard + Contestants | Highest scorer, most tasks, captain, leading team, completion rate, nominees, immunity, evictions, house points |
| 12 | **Eviction** | Evictions view · Danger Zone | Confirmation modal, immunity override warning, glitch removal, leaves the leaderboard, releases tasks, can be reinstated |

Extra: **Activity Log** (filterable audit trail), **Settings** (house config, backups, reset demo data, appearance).

## 6. Manual QA checklist

Run `npm start`, open http://localhost:5173 and walk through this list. Every step must leave the UI consistent
after a page refresh (state persists in `localStorage` under the `bb-command-centre.v1` key).

**1 · Contestants**
- [ ] Dashboard → Contestants: 12 cards with avatar, team chip, points and status badge (Captain on Devansh).
- [ ] Search "zara" narrows the grid; clearing restores it.
- [ ] Status filter *Nominated / Immune / Evicted / All* changes the grid; team filter narrows by team.
- [ ] **Add contestant** → name + team → appears instantly; adding the same name again is rejected with a toast.

**2 · Leaderboard**
- [ ] Leaderboard view lists all active contestants sorted by points, with gold/silver/bronze medals.
- [ ] On any row press **+10** ten times: the row climbs, flashes green, and the number counts up.
- [ ] Press **−10**: the row slides down, flashes red, and the ×10 delta badge floats above the score.

**3 · Tasks**
- [ ] **Assign task** → preset "Coding Sprint", pick 2 contestants → appears on the Task Board as *Pending*.
- [ ] **Start** → *In Progress*; **Mark complete** → *Completed* badge, both assignees gain the task points and +1 task count.
- [ ] **Reopen** → *In Progress* (points are not refunded); **Failed** marks it red; the trash icon deletes after confirmation.

**4 · Points**
- [ ] Card ⋯ → *Adjust points* → −5 with a reason → score drops; the reason appears in the Activity Log.
- [ ] Try to drive a score below zero: it clamps to 0.

**5 · Captaincy**
- [ ] Nominations → *Change* → pick someone else → sidebar captain chip and the crown badge move; only one Captain exists.
- [ ] Dashboard stat "Current Captain" updates; **Revoke** makes it *Vacant*.

**6 · Nominations**
- [ ] Nominations → select two contestants + reason → **Nominate selected** → both appear in the Danger Zone with the round number.
- [ ] Try to nominate the same person again: they are no longer offered, and the card menu item is disabled.

**7 · Immunity**
- [ ] Card ⋯ → *Grant immunity* → green shield badge + banner *"…won immunity. The House cannot touch them."*
- [ ] The card shows a green **Nominate** button: click it → toast **"Immunity active — nomination denied"** and the contestant stays out of the Danger Zone.
- [ ] Grant immunity to someone already nominated → their nomination is revoked automatically.

**8 · Danger Zone**
- [ ] The Danger Zone card on the dashboard turns crimson with a pulsing border and lists every nominee.
- [ ] The sidebar badge counts them; **Withdraw** removes one and updates the count immediately.

**9 · Announcements**
- [ ] Header **Make Announcement** → pick the *alert* preset → **Broadcast** → full-screen banner with a pulsing eye, typewriter text and a progress bar; it auto-dismisses, or Esc / ✕ closes it.
- [ ] The message is stored in the archive and **Replay** re-shows it.

**10 · Task timer**
- [ ] Tasks → **03:00** preset → *Start* → the ring animates and the top-bar chip shows *Running*.
- [ ] Set 00:20 (Custom) and start: the ring turns **amber** under 30 s and **pulsing crimson** under 10 s.
- [ ] At zero the app broadcasts *TIME IS UP*, the log records it, and the ring shows *Time up*.
- [ ] **Pause** freezes the clock, **Reset** restores the duration. Reload mid-run: the countdown resumes correctly (timestamp-based).

**11 · Statistics**
- [ ] Dashboard shows six animated cards: Total Active, Highest Scorer, Current Captain, Tasks Completed (x/y), Nominees, Evicted.
- [ ] Contestants → House Statistics lists highest scorer, most tasks, captain, leading team, completion rate, immune/nominee/evicted counts, and every value matches the data.

**12 · Eviction**
- [ ] Danger Zone → **Evict** → confirmation modal → the screen glitches, the banner announces the eviction.
- [ ] The contestant disappears from the leaderboard and from task assignees; the active counter drops by one.
- [ ] Evictions view lists them with their final score; **Reinstate** returns them to the House and the leaderboard.
- [ ] Try to evict an immune contestant: the modal first warns **"Override immunity…"** and the override is written into the log.
- [ ] **Evict the Danger Zone** removes the whole round in one confirmed action.

**Brand**
- [ ] Boot: the SPARTANS X TECH BOSS splash appears, then the control room fades in.
- [ ] Sidebar crest + wordmark visible; collapse the sidebar → crest shrinks, wordmark hides.
- [ ] Dashboard hero shows the key art, season lockup, live chips and the three quick actions (Announce / Assign task / Nominate).
- [ ] Make an announcement → the banner shows the crest badge and the brand lockup in its footer.
- [ ] Browser tab shows the crest favicon; the tab title reads "… · Big Boss Command Center".

**Icons & PWA**
- [ ] Browser tab shows the crest favicon (not a blank/grey page icon).
- [ ] `curl -sI <url>/favicon.ico` → `200` + `image/x-icon`; `<url>/nope.png` → `404`, never HTML.
- [ ] `curl -sI <url>/site.webmanifest` → `application/manifest+json`; Chrome DevTools → Application → Manifest lists 4 icons.
- [ ] Share the URL in a chat app: the preview shows the SPARTANS X TECH BOSS `og-image` card.

**System**
- [ ] Refresh the page: every change is still there (localStorage).
- [ ] Settings → **Reset demo data** restores the 12-contestant season; **Empty the House** clears it.
- [ ] Settings → toggle the 3D background; enable *prefers-reduced-motion* in your OS and confirm motion stops (static gradient).
- [ ] Keyboard: `1…9` switch sections, `B` collapses the sidebar, `N` opens the announcement composer, `T` toggles the timer, `Esc` closes overlays, `Tab` walks every control with a visible focus ring.

## 7. Production notes

- **Deploy** — Render Web Service via `render.yaml` (`npm ci --omit=dev` → `node server.cjs`,
  health check `/healthz`, `autoDeploy` on `main`). Live: **https://command-centre-byspartans.onrender.com/**.
  Guide: **[docs/DEPLOY.md](docs/DEPLOY.md)**. Any static host works too, since the runtime has zero
  dependencies.

- **Performance** — no framework, no runtime fetches beyond the vendor bundle and fonts; DPR ≤ 2; the 3D loop pauses on hidden tabs; timers never trigger a full re-render (only the clocks/rings are patched).
- **Accessibility** — semantic landmarks, `aria-live` toasts, `role="alertdialog"` banner, focus trapping in modals, visible focus rings, skip link, AA-contrast palette, colour never used alone.
- **Security** — all user text is escaped before it reaches the DOM; the server blocks path traversal and sets `X-Content-Type-Options: nosniff`.

## 8. Team

**SPARTANS X TECH BOSS** — built for the Tech House. Big Boss is watching. 🫡
