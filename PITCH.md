---
marp: true
theme: default
paginate: true
---

<!-- Slide 1 -->

# Lineup
### *Not a Luma replacement — the fast lane next to it.*

Keep Luma for the real event page. But the moment you need to **announce it** — an email, a Slack post, an Instagram story, a "here's who's speaking" — you're back to juggling Canva + a QR generator + a calendar file.

**Lineup** turns one sentence in ChatGPT into shareable assets, instantly:

> *"Announce Friday's panel — speakers Lea, Marco and Priya — accent red."*

→ a ready-to-post **event card** · an **identity badge** per speaker (photo-style avatar + role + scannable contact QR) · an **RSVP QR** · a calendar **.ics**. Drop them straight into the email or the post. ~10 seconds.

---

<!-- Slide 2 -->

# One primitive, many use cases

The primitive is simple: **people + a moment + a scannable code.** Reshape it:

| Use case | What it gives you |
|---|---|
| 📣 **Announce an event** | Card + QR + .ics to paste into an email or social post |
| 🎤 **Share who's speaking** | A badge per speaker — photo, role, contact QR |
| 🗳️ **Voting / polls** | A **unique code sent to each person** — one ballot QR per voter |
| 🪪 **Conference ID / access badges** | Printable badge, role, check-in QR |
| 🤝 **Networking** | Badge whose QR drops your contact into a phone |
| 🏆 **Team rosters / hackathon crews** | Collectible "trading card" per member |

It **complements** Luma, Mailchimp, your CMS — Lineup is the **10-second asset generator** that sits in the chat you're already in. Fast to create, fast to share.

---

<!-- Slide 3 -->

# How & where it runs

**The stack is the moat** — each piece does one thing well:

- **Skybridge (Alpic)** — a real React UI *inside* ChatGPT + tunnel + deploy
- **qrcode · DiceBear · ics** — tiny, deterministic generators (QR / avatars / calendar)
- **The LLM** — parses your sentence into fields, writes the microcopy

```
ChatGPT ──/mcp (No Auth)──► Alpic tunnel ──► Skybridge server (localhost:3000)
                                              ├─ generate-lineup tool
                                              ├─ qrcode · DiceBear · ics
                                              └─ React view (in ChatGPT)
```

- **Now:** runs on the laptop, exposed via an Alpic tunnel for the live demo.
- **Submission:** `npm run deploy` → **Alpic Cloud** (free). Pure-JS / edge-safe → Cloudflare Workers fallback. No accounts, no scraping.

### *Lineup: the fastest way to turn a sentence into something everyone can hold in their hand.*
