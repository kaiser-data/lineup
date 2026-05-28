# Sample prompts

Copy-paste these into Claude Code (the `lineup` MCP is connected) or into ChatGPT with the Lineup connector. The LLM parses the sentence into the tool's structured arguments; the view renders the pack inline.

---

## 1. The canonical demo

> Use lineup to generate a pack for tonight's Berlin Hack Night at Mindspace, 18:00, accent red, with Marty as Host, Lea as Judge, and Tomás as Hacker.

The one-sentence pitch live. Default `lorelei` style, red accent, three badges, RSVP QR, .ics.

---

## 2. Show off the four avatar styles

> Use lineup to make a **hackathon robot roster** for Sunday at Mindspace, accent green, with Aisha, Kenji, Marco, Priya, Zoe and Omar.

→ The LLM picks `bottts` (colorful robots) — the "trading card" vibe.

> Use lineup to print **conference access badges** for DevConf Berlin Sept 24 9am at STATION Berlin, accent blue, check-in link https://devconf.berlin/check-in — Hannah Reyes (Speaker), Marco Bianchi (Attendee), Aisha Okonkwo (Crew), Liam Foster (Press), Yuki Tanaka (Sponsor), Elena Petrova (Volunteer).

→ `notionists` — Notion-style sketch, polished for conference IDs.

> Use lineup to make **anonymous voting cards** for our board budget vote on June 18 5pm in Town Hall Room 2B, accent green, ballot link https://vote.example.org/budget-2026 — voters Nadia (Seat 1), Omar (Seat 2), Priya (Seat 3), Stefan (Seat 4), and Clara as Chair.

→ `shapes` — abstract geometric, perfect for ballots.

---

## 3. The "announce it" use case — what Luma can't

> Use lineup to announce **Friday's panel on AI in healthcare** at Holzmarkt 6pm — accent purple, RSVP at https://lu.ma/ai-health, speakers Dr. Hannah Reyes, Marco Bianchi, and Priya Nair. Make it look professional, notionists style.

The badges become the speaker cards for the email / story / Slack post.

> Use lineup to spin up **rooftop drinks tomorrow 6:30pm at Klunkerkranich Neukölln**, accent pink, RSVP https://lu.ma/rooftop-friday — invite the whole team.

The one-sentence announcement.

---

## 4. Other shapes of the same primitive

> Use lineup to make an **after-party invite for Käthe & Theo's wedding**, August 15 22:00 at Sisyphos Berlin, accent orange, RSVP https://kthe.party/yes — Käthe (Bride), Theo (Groom), Anna (Maid of Honor), Felix (Best Man), Greta (DJ), Paul (Photographer).

> Use lineup to build a **founders dinner card** for Saturday 8pm at Mr. Susan Berlin, accent purple, just Sara, Jonas and Mei.

> Use lineup for a **hackathon crew roster** — robots style — Team Hydra for the 48-hour build: Yuki, Aisha, Marco, Omar, Sofia. Accent neon green.

---

## 5. Follow-ups that work inside the view

After generating, try saying:

> Switch the style to bottts.

> Make the accent brighter — try electric blue.

> Add Sofia as Photographer.

> Show me the share link as a QR I can scan.

(The view persists state via `useViewState`, so the LLM sees the current style/selection — these follow-ups stay in context.)

---

## 6. Minimal-input test (let the LLM fill defaults)

> Use lineup. Coffee tomorrow 10am. Just me — Marty.

Confirms the tool gracefully handles a tiny one-attendee event.

---

## What success looks like

For each prompt you should see:
- ✓ A **Luma-style event card** with the accent gradient, "Add to calendar", and an RSVP QR.
- ✓ One **identity badge per person**: avatar in a halo, first name, role pill, vCard QR.
- ✓ A **Style chip row** with four options — clicking flips every avatar in place.
- ✓ A **Share link** (with a scannable QR) that opens the same pack as a public page on GitHub Pages — nothing stored.
- ✓ A **"Download"** button on each badge → real 480×640 PNG trading card.

If any of those is missing, the connector is pointed at an old deploy — re-add it pointing at `https://lineup-bf157e35.alpic.live/mcp`.
