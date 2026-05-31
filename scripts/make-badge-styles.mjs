// Regenerate assets/badge-styles.png — the four-style showcase in the README.
//
// This is fully self-hosted: every pixel is produced locally from the same
// open-source libraries the app uses (DiceBear avatars, qrcode, Satori + Resvg).
// No external image service, no API key.
//
//   node scripts/make-badge-styles.mjs
//
// The Lorelei "organizer" card pins a calm mouth so the avatar reads serious
// (DiceBear's default for that seed sticks its tongue out).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import { createAvatar } from "@dicebear/core";
import { lorelei, notionists, bottts, shapes } from "@dicebear/collection";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../assets/badge-styles.png");

const interRegular = readFileSync(require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff"));
const interBold = readFileSync(require.resolve("@fontsource/inter/files/inter-latin-700-normal.woff"));

const STYLE_DEFS = { lorelei, notionists, bottts, shapes };

// One column per card. Accent + label match the README showcase.
const CARDS = [
  { style: "notionists", name: "Aisha", role: "Speaker", accent: "#6366f1", label: "Notionists" },
  { style: "bottts", name: "Priya", role: "Judge", accent: "#22c55e", label: "Bottts" },
  // Pin a calm mouth so the organizer avatar looks professional, not cheeky.
  { style: "lorelei", name: "Mei", role: "Organizer", accent: "#ef4444", label: "Lorelei", opts: { mouth: ["happy01"] } },
  { style: "shapes", name: "Zoe", role: "Designer", accent: "#3b82f6", label: "Shapes" },
];
const EVENT_TITLE = "Berlin Hack Night";

function avatarPng(style, seed, opts = {}) {
  const svg = createAvatar(STYLE_DEFS[style], {
    seed,
    size: 256,
    backgroundColor: ["transparent"],
    ...opts,
  }).toString();
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 200 } }).render().asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}

const div = (style, children) => ({ type: "div", props: { style: { display: "flex", ...style }, children } });
const img = (src, style) => ({ type: "img", props: { src, style } });

function card({ style, name, role, accent, opts }, qrPng) {
  return div(
    {
      width: 300,
      padding: 4,
      borderRadius: 24,
      backgroundImage: `linear-gradient(140deg, ${accent}, ${accent}59 50%, ${accent})`,
    },
    div(
      {
        width: "100%",
        height: 392,
        backgroundColor: "#ffffff",
        borderRadius: 20,
        flexDirection: "column",
        alignItems: "center",
        padding: 22,
        position: "relative",
      },
      [
        div(
          {
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: `${accent}2e`,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 14,
          },
          img(avatarPng(style, name, opts), { width: 126, height: 126, borderRadius: 63 }),
        ),
        div({ marginTop: 20, fontSize: 34, fontWeight: 700, color: "#111111" }, name),
        div(
          {
            marginTop: 10,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 5,
            paddingBottom: 5,
            borderRadius: 999,
            backgroundColor: `${accent}24`,
            color: accent,
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
          },
          role.toUpperCase(),
        ),
        div(
          { position: "absolute", bottom: 20, left: 22, right: 22, alignItems: "flex-end", justifyContent: "space-between" },
          [
            div({ flexDirection: "column" }, [
              div({ fontWeight: 700, fontSize: 10, color: "#a1a1aa" }, "SCAN TO SAVE"),
              div({ fontWeight: 700, fontSize: 13, color: "#111111", marginTop: 3 }, EVENT_TITLE),
            ]),
            div(
              { width: 78, height: 78, padding: 5, backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 10 },
              img(qrPng, { width: 68, height: 68 }),
            ),
          ],
        ),
      ],
    ),
  );
}

const VCARD = (name, role) =>
  ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, `N:;${name};;;`, `TITLE:${role}`, `NOTE:Met at ${EVENT_TITLE}`, "END:VCARD"].join("\r\n");

const qrPngs = await Promise.all(
  CARDS.map((c) =>
    QRCode.toDataURL(VCARD(c.name, c.role), { type: "image/png", margin: 1, width: 200, color: { dark: "#111111", light: "#ffffff" } }),
  ),
);

const tree = div(
  { backgroundColor: "#fafaf7", padding: 36, gap: 22, alignItems: "flex-start" },
  CARDS.map((c, i) =>
    div({ flexDirection: "column", alignItems: "center", gap: 14 }, [
      card(c, qrPngs[i]),
      div({ fontSize: 15, color: "#71717a", fontWeight: 400 }, c.label),
    ]),
  ),
);

const WIDTH = 36 * 2 + 300 * 4 + 22 * 3 + 8 * 4; // padding + cards + gaps + borders
const svg = await satori(tree, {
  width: WIDTH,
  height: 520,
  fonts: [
    { name: "Inter", data: interRegular, weight: 400, style: "normal" },
    { name: "Inter", data: interBold, weight: 700, style: "normal" },
  ],
});

const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH * 1.6 } }).render().asPng();
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${png.length} bytes)`);
