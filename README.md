# Lineup

**Turn one sentence into a full event pack — inside ChatGPT.**

Lineup is a ChatGPT App (built on [Alpic Skybridge](https://docs.skybridge.tech)) that takes a freeform event description and generates a Luma-style **event card**, an **identity badge** for every attendee (generated avatar + role + scannable vCard QR), an **RSVP QR**, and a calendar **`.ics`** — in about ten seconds, in the conversation you're already in.

> *"Announce Friday's panel — speakers Lea, Marco and Priya — accent red, notionists style."*

![Four identity badges across four avatar styles: notionists, bottts, lorelei, shapes](assets/badge-styles.png)

Built for Berlin Hack Night (May 2026) using the Skybridge framework + OpenAI Codex.

---

## Why

Keep Luma for the real event page. But the moment you need to **announce it** — an email, a Slack post, a story, a "who's speaking" card — you're back to juggling Canva + a QR generator + a calendar file. Lineup is the **10-second asset generator** that lives in the chat: one sentence in, shareable assets out.

It **complements** Luma / Mailchimp / your CMS rather than replacing them.

## What it does

- **Event card** — title, date, venue, accent gradient, "Add to calendar", RSVP QR
- **Identity badges** — one per attendee: deterministic [DiceBear](https://dicebear.com) avatar in a halo, first name, role pill, vCard QR (scan → save contact), gradient accent border
- **Pick the avatar style from the prompt** — four styles ship; tell the LLM the vibe and it picks (see below)
- **PNG badge export** — download any badge as a real 480×640 "trading card" PNG, composed server-side with [Satori](https://github.com/vercel/satori) + [Resvg](https://github.com/yisibl/resvg-js)
- **Shareable event page** — a scannable link that opens the whole pack as a public web page (see below)

### Avatar styles

The whole crew renders in one consistent style. Just say what you want — the LLM picks it from your sentence.

| Style | Vibe | Try saying… |
|---|---|---|
| **`lorelei`** *(default)* | Monochrome line art — calm, professional | *"…default style"* (or omit) |
| **`notionists`** | Notion-style sketch — friendly meetups | *"…in notionists style"* |
| **`bottts`** | Colorful robots — playful trading cards | *"…make it a hackathon robot roster"* |
| **`shapes`** | Abstract geometric — anonymous-looking | *"…anonymous voting cards"* |

## One primitive, many use cases

`people + a moment + a scannable code` reshapes into:

| Use case | What it gives you |
|---|---|
| 📣 Announce an event | Card + QR + `.ics` to paste into an email or post |
| 🎤 Share who's speaking | A badge per speaker — avatar, role, contact QR |
| 🗳️ Voting / polls | A unique card + ballot QR per voter |
| 🪪 Conference ID / access | Printable badge, role, check-in QR |
| 🤝 Networking | Badge QR drops your contact into a phone |
| 🏆 Team rosters / crews | A collectible "trading card" per member |

## The shareable page is zero-knowledge by design

The "Share this page" QR/link encodes the **entire compact payload in the URL `#fragment`**. A static page ([`docs/index.html`](docs/index.html) on GitHub Pages) decodes it and regenerates the event card + badges **client-side** (avatars and QRs are deterministic). 

Nothing is stored in any database. Browsers never send URL fragments to servers, so neither GitHub nor the author can read a shared link — **only the people you send it to can.**

🔗 **Live share page:** https://kaiser-data.github.io/lineup/ (open with a Lineup `#…` fragment)

## Live

- **App (MCP endpoint):** `https://lineup-bf157e35.alpic.live/mcp`
- **Playground:** https://lineup-bf157e35.alpic.live/try
- **Share page:** https://kaiser-data.github.io/lineup/

### Add to ChatGPT
1. ChatGPT → Settings → Connectors → **Create**
2. Server URL: `https://lineup-bf157e35.alpic.live/mcp` · Authentication: **No Auth**
3. In a chat: `@lineup Generate a Lineup for Berlin Hack Night at Mindspace, 18:00, accent red, with Marty (Host), Lea (Judge), and Tomás (Hacker).`

## Architecture

```
ChatGPT ──/mcp (No Auth)──► Alpic Cloud · Skybridge MCP server
                              ├─ generate-lineup   (event card + badges + QR + .ics)
                              ├─ render-badge-png   (Satori + Resvg → PNG)
                              └─ React view (renders inside ChatGPT)

Share:  view encodes payload → URL #fragment → QR
        GitHub Pages static page decodes + regenerates (no backend, nothing stored)
```

Everything is deterministic and pure-JS where it matters (avatars, QRs, calendar), so the same input always produces the same pack — which is exactly why the shareable page can regenerate it from the link alone.

## Tech

[Skybridge](https://docs.skybridge.tech) · React · TypeScript · [qrcode](https://github.com/soldair/node-qrcode) / qrcode.react · [@dicebear](https://dicebear.com) · [ics](https://github.com/adamgibbons/ics) · [satori](https://github.com/vercel/satori) · [@resvg/resvg-js](https://github.com/yisibl/resvg-js)

## Develop

```bash
npm install
npm run dev          # MCP server + DevTools at http://localhost:3000
npm run dev -- --tunnel   # expose to ChatGPT/Claude for testing
```

Tools live in [`src/server.ts`](src/server.ts); the view is [`src/views/generate-lineup.tsx`](src/views/generate-lineup.tsx); generators are in [`src/lib/`](src/lib).

Helper scripts in [`scripts/`](scripts): `status.sh`, `test.sh <payload>`, `save-artifacts.sh`, `tunnel.sh`, `stop.sh`. Test payloads (incl. voting / conference / announcement use cases) in [`test-payloads.json`](test-payloads.json).

## Deploy

```bash
npm run deploy       # → Alpic Cloud (free)
```

Pure-JS / edge-friendly libraries keep Cloudflare Workers viable as a fallback.

## License

MIT
