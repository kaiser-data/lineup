# Lineup — Session Handoff

_Last updated: 2026-05-29. For continuing work in a new session._

## What Lineup is

A **ChatGPT/Claude App** (Alpic **Skybridge** MCP server) that turns one sentence into an event pack: a Luma-style **event card**, an **identity badge** per attendee (DiceBear avatar + role + vCard QR), an **RSVP QR**, a calendar **`.ics`**, downloadable **badge PNGs**, and a **zero-knowledge shareable web page**. Built for Berlin Hack Night (submission **Sun 31 May 23:59**). Coded mainly with **Claude Code**, Codex in support.

- **Repo:** https://github.com/kaiser-data/lineup (public, owner `kaiser-data`)
- **Live app (MCP):** `https://lineup-bf157e35.alpic.live/mcp` · playground `/try`
- **Share page (GitHub Pages):** https://kaiser-data.github.io/lineup/
- **MCP registry:** published, active (`live.alpic.lineup-bf157e35/lineup`)
- **Working dir:** `/Users/marty/claude-projects/hackathon/BerlinHackNightGPTApp/lineup`

## Current state — everything below is DONE, committed, pushed, and deployed

| Feature | Where | Status |
|---|---|---|
| `generate-lineup` tool (card+badges+QR+.ics) | `src/server.ts`, `src/lib/*` | ✅ live |
| `render-badge-png` tool (Satori+Resvg → PNG) | `src/lib/badge-png.ts` | ✅ live, verified in prod |
| React view (event card + badge grid) | `src/views/generate-lineup.tsx` | ✅ live |
| Loading skeleton + hover lift | same | ✅ |
| **Avatar style** arg `lorelei\|notionists\|bottts\|shapes` (no option filters) | `src/lib/avatars.ts`, `server.ts` | ✅ live, LLM picks from prompt |
| **Interactive style flipper** (4 chips, fades, `useViewState`) | view | ✅ live |
| **Zero-knowledge share page** — payload in URL `#fragment`, regenerated client-side on GitHub Pages, nothing stored | `docs/index.html` + `buildShareUrl` in view | ✅ live |
| Deploy to Alpic Cloud | `npx alpic deploy --non-interactive` | ✅ stable URL |
| README (live URLs, use cases, 4-style hero, inline SVG architecture) | `README.md`, `assets/` | ✅ |
| Pitch deck + QR | `PITCH.md`, `Lineup.pptx`, `repo-qr.png` | ✅ |
| Architecture diagram | `assets/architecture.svg` (inline) + `architecture.excalidraw` (source) | ✅ |
| Sample prompts | `PROMPTS.md` | ✅ |
| Test payloads (incl. voting/conference/announcement) | `test-payloads.json` | ✅ |
| Helper scripts | `scripts/{dev,tunnel,stop,status,test,save-artifacts}.sh` | ✅ |

## How to deploy / verify (commands that work)

```bash
cd /Users/marty/claude-projects/hackathon/BerlinHackNightGPTApp/lineup
npm run dev                       # local: MCP at :3000/mcp + DevTools at :3000
npx tsc --noEmit                  # typecheck (must be clean before deploy)
npm run build                     # prod build sanity check
npx alpic deploy --non-interactive   # → same stable URL lineup-bf157e35.alpic.live
./scripts/test.sh berlin_hack_night   # exercise a payload against local :3000
```

Prod MCP needs the full handshake (initialize → notifications/initialized → tools/call). The dev server (:3000) is lenient and accepts a bare `tools/list`. There's a verified curl handshake recipe in the session history if needed.

## Connecting clients

- **Claude Code:** already added — `claude mcp list` shows `lineup … ✓ Connected` (native HTTP, scoped to this project). Remove with `claude mcp remove lineup`.
- **ChatGPT:** Connectors → Create → URL `…/mcp` → No Auth. Native remote = works.
- **Claude Desktop:** MUST use **Settings → Connectors → Add custom connector** (native remote), NOT the config file. See open issue below.

## ⚠️ OPEN ISSUE — Claude Desktop `ui.domain` error

**Symptom:** Claude Desktop shows _"ui.domain cannot be used with local connectors. Stable sandbox origins require a remote connector with a verified URL."_

**Root cause (confirmed):** Skybridge **always** advertises `ui.domain` (= deploy URL) on the view resource — correct and unavoidable for a deployed app. Connecting Claude Desktop via `mcp-remote` (a stdio bridge, configured in `claude_desktop_config.json`) makes Claude Desktop treat it as a **local/stdio connector**, and `ui.domain` is only allowed for **native remote** connectors.

**Resolution (do this, don't re-debug):**
1. The broken `lineup` stdio entry was **already removed** from `~/Library/Application Support/Claude/claude_desktop_config.json` (backups: `*.backup.*` next to it; the file still has `blender` + `kitsune`).
2. User must restart Claude Desktop, then add Lineup via **Settings → Connectors → Add custom connector**, URL `https://lineup-bf157e35.alpic.live/mcp`, **No Auth**. Requires a paid Claude plan.

**Note:** an earlier commit (`d1a6bb7`) removed an explicit `view.domain: "skybridge.tech"` placeholder from `server.ts` thinking it was the fix — it was NOT (Skybridge re-derives the domain from the deploy URL). The edit is harmless and left in. Do not chase the source for this; it's purely a connector-type issue.

## Open / possible next tasks (none blocking submission)

1. **Per-badge face shuffle** (user asked, not yet built): a small ⟳ on each badge to re-roll just that one avatar (next seed variant: `Lea` → `Lea 2` → …), keeping the crew's shared style. State in `useViewState`; PNG + share link follow the override. Decided AGAINST per-badge *style* override (looks chaotic) — shuffle the seed, keep one style.
2. **Glama / mcp.so listing** — should auto-crawl from the MCP registry + public repo; can also be claimed manually.
3. **ChatGPT Apps store submission** (optional) — Alpic Distribution tab → OpenAI verification token → submit for review.
4. Persistence/Supabase was explicitly **dropped** in favor of the no-DB share page (more wow, zero infra, zero-knowledge by construction). A `lineups` table migration was **blocked by the safety classifier** and never created — don't revive without explicit user OK.

## Key facts to remember

- Avatars are **deterministic from the name** → some seeds look masculine/feminine by luck (e.g. "Lea Schmidt" rendered masculine; bare "Lea" looks feminine). This is why the shuffle idea exists.
- **No paid APIs, no DB, no accounts.** Only LLM cost is ChatGPT parsing the sentence (the user's own plan). Big SVGs go in `structuredContent` (view-only, ~0 LLM tokens).
- Libraries: Skybridge(ISC), React/Vite/zod/qrcode/dicebear(MIT), ics/qrcode.react(ISC), satori/resvg(MPL-2.0 weak-copyleft, fine as deps), fontsource Inter(OFL). Project license: MIT.
- `git status` is clean; everything pushed to `origin/main`. `assets/styles/`, `out/`, `.alpic/`, `node_modules/` are gitignored.
