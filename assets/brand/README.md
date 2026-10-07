# Brand assets — SPARTANS X TECH BOSS

The Command Center ships with the official crew logo. Everything in this folder is
generated from **one master image**, so swapping in new artwork takes seconds.

## Files

| File | Size | Used by |
|---|---|---|
| `logo-source.jpg` | full-res master (1536×1024) | source of truth for the pipeline |
| `logo-mark.png` / `logo-mark.jpg` | 256² / 512² | sidebar crest, announcement banner, favicon, apple-touch (1x / 2x) |
| `logo-wide.jpg` | 720×480 | dashboard hero + boot splash (1x) |
| `logo-hero.jpg` | 1280×853 | dashboard hero + boot splash (2x) |
| `logo-square.jpg` | 640² | apple-touch-icon / social sharing |

## Swap in your own artwork

```bash
npm run brand:logo -- ~/Downloads/my-logo.jpg   # normalises the master + regenerates every derivative
```

- The source image should be at least **1280 px wide**, dark background, with the
  crest/eye focal point near the centre.
- To move the crest crop, edit `MARK_CROP` in `scripts/sync-logo.mjs` (`WxH+X+Y`).
- After regenerating, hard-refresh the browser (`Ctrl/Cmd + Shift + R`) to bust the
  image cache.

## Where the logo appears

- **Sidebar** — crest + `SPARTANS X TECH BOSS` wordmark (the wordmark hides when the rail is collapsed).
- **Dashboard hero** — full key art with the season lockup, live status chips and the three fastest Big Boss actions.
- **Boot splash** — full key art while the control room establishes its feed.
- **Big Boss announcement banner** — crest badge + brand lockup in the footer.
- **Browser** — favicon and apple-touch-icon.
