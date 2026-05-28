import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import { generateAvatarSvg, type AvatarStyle } from "./avatars.js";
import { buildVcard } from "./vcard.js";

const require = createRequire(import.meta.url);
const interRegular = readFileSync(
  require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff"),
);
const interBold = readFileSync(
  require.resolve("@fontsource/inter/files/inter-latin-700-normal.woff"),
);

function svgToPngDataUrl(svg: string, width: number): string {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
  })
    .render()
    .asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}

type El = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown; [k: string]: unknown };
};

const div = (style: Record<string, unknown>, children?: unknown): El => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const img = (src: string, style: Record<string, unknown>): El => ({
  type: "img",
  props: { src, style },
});

export async function renderBadgePng(args: {
  name: string;
  role?: string;
  accentHex?: string;
  eventTitle?: string;
  avatarStyle?: AvatarStyle;
}): Promise<string> {
  const { name, role = "Guest", accentHex = "#6366f1", eventTitle, avatarStyle } = args;
  const firstName = name.split(" ")[0];

  const avatarPng = svgToPngDataUrl(generateAvatarSvg(name, avatarStyle), 200);
  const vcardQrPng = await QRCode.toDataURL(
    buildVcard({ name, role, eventTitle }),
    { type: "image/png", margin: 1, width: 200, color: { dark: "#111111", light: "#ffffff" } },
  );

  const tree = div(
    {
      width: 480,
      height: 640,
      padding: 6,
      borderRadius: 32,
      backgroundImage: `linear-gradient(140deg, ${accentHex}, ${accentHex}66 50%, ${accentHex})`,
    },
    div(
      {
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        borderRadius: 26,
        flexDirection: "column",
        alignItems: "center",
        padding: 32,
        position: "relative",
      },
      [
        div(
          {
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: `${accentHex}22`,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 24,
          },
          img(avatarPng, { width: 168, height: 168, borderRadius: 84 }),
        ),
        div(
          {
            marginTop: 28,
            fontSize: 46,
            fontWeight: 700,
            color: "#111111",
          },
          firstName,
        ),
        div(
          {
            marginTop: 14,
            paddingLeft: 18,
            paddingRight: 18,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 999,
            backgroundColor: `${accentHex}22`,
            color: accentHex,
            fontSize: 18,
            fontWeight: 700,
            textTransform: "uppercase",
          },
          role.toUpperCase(),
        ),
        div(
          {
            position: "absolute",
            bottom: 28,
            left: 32,
            right: 32,
            alignItems: "flex-end",
            justifyContent: "space-between",
          },
          [
            div(
              { flexDirection: "column", color: "#71717a", fontSize: 16 },
              [
                div({ fontWeight: 700, fontSize: 13, color: "#a1a1aa" }, "SCAN TO SAVE"),
                div({ fontWeight: 700, color: "#111111", marginTop: 4 }, eventTitle ?? "Lineup"),
              ],
            ),
            div(
              {
                width: 104,
                height: 104,
                padding: 6,
                backgroundColor: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: 12,
              },
              img(vcardQrPng, { width: 92, height: 92 }),
            ),
          ],
        ),
      ],
    ),
  );

  const svg = await satori(tree as unknown as React.ReactNode, {
    width: 480,
    height: 640,
    fonts: [
      { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
    ],
  });

  const png = new Resvg(svg).render().asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}
