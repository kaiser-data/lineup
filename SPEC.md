# Lineup

A ChatGPT App that turns one event description into a full event pack: a Luma-style event card, an identity badge per attendee (avatar + role + vCard QR), an RSVP QR code, and a calendar `.ics`.

## Value Proposition

Generate event packs with identity badges through conversation. Target: anyone organising a small event (hackathon, meetup, wedding, dinner) who otherwise jumps between Luma + Canva + a QR generator + a calendar file builder. Pain today: 4 tools, 20 minutes, mediocre output.

**Core actions**: Generate event pack, download artifacts.

## Why LLM?

**Conversational win**: "Throw me a launch party for 8 people Friday at Soho House, accent red" = one sentence vs. filling forms across multiple sites.

**LLM adds**: Parses freeform descriptions into structured fields (date, attendees, accent), picks role labels, writes microcopy.

**What LLM lacks**: QR generation, avatar generation, calendar `.ics` structure, badge composition — all deterministic, delegated to libraries via tools.

## UI Overview

**First view**: An event header (title, date, venue, accent gradient, "Download .ics" + RSVP QR) above a responsive grid of identity badges. Each badge: generated avatar inside a pastel halo, big first name, role pill, vCard-encoded QR in the corner, gradient border in the event accent. Hover lifts the card.

**Key interactions**: Click "Download" on any badge → PNG saves. Click event-level "Download .ics" / "Download QR".

**End state**: User has downloaded the assets and closed the chat with everything they need to launch the event.

## Product Context

- **Existing products**: None — net new
- **APIs / data**: None external. All deterministic libraries: `qrcode`, `@dicebear/core` + `@dicebear/collection`, `ics`, `satori` + `@resvg/resvg-js`
- **Auth**: None (no accounts, no persistence)
- **Constraints**: Pure-JS libs only (edge-deploy compatible); ChatGPT-first via Skybridge tunnel; final deploy to Alpic Cloud

## UX Flows

**Generate event pack**
1. User describes event (freeform or structured) in chat
2. App returns event card + per-attendee identity badges + QR + .ics
3. User downloads artifacts they want

## Tools and Views

**View: generate-lineup**
- **Input**: `{ title, dateISO, venue?, accentHex?, rsvpUrl?, attendees: [{ name, role? }] }`
- **Output (structuredContent)**: `{ event: { title, dateISO, venue, accentHex, rsvpUrl, icsString, qrSvg }, badges: [{ name, role, avatarSvg, vcardQrSvg }] }`
- **Views**: event card + badge grid (single view, manages own selection state)
- **Behavior**: Calls `render-badge-png` when the user clicks "Download" on a badge.

**Tool: render-badge-png**
- **Input**: `{ name, role?, avatarSvg, vcardQrSvg, accentHex }`
- **Output**: `{ pngDataUrl }`
- **Behavior**: Composes the badge via Satori (JSX → SVG) + Resvg (SVG → PNG); returns a `data:image/png;base64,…` URL the view triggers as a download.
