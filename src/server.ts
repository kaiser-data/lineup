import { McpServer } from "skybridge/server";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateAvatarSvg, AVATAR_STYLES, DEFAULT_AVATAR_STYLE, GENDERS } from "./lib/avatars.js";
import { generateQrSvg } from "./lib/qr.js";
import { buildVcard } from "./lib/vcard.js";
import { buildIcs } from "./lib/ics.js";
import { renderBadgePng } from "./lib/badge-png.js";

const attendeeSchema = z.object({
  name: z.string().describe("Attendee full name"),
  role: z
    .string()
    .optional()
    .describe("Short role label (e.g. 'Host', 'Judge', 'Hacker')"),
  gender: z
    .enum(GENDERS)
    .optional()
    .describe(
      "Optional gender hint to make the avatar read more clearly: 'm' (no earrings, may have a beard), 'f' (no beard, may have earrings), or 'x'/omit for neutral. Only affects the lorelei & notionists styles. Infer from the name when the user clearly implies it, otherwise omit.",
    ),
});

const server = new McpServer(
  {
    name: "lineup",
    version: "0.1.0",
  },
  { capabilities: {} },
).registerTool(
  {
    name: "generate-lineup",
    description:
      "Generate an event pack: a Luma-style event card with .ics + RSVP QR, and an identity badge per attendee with a deterministic avatar and vCard-encoded QR.",
    inputSchema: {
      title: z.string().describe("Event title"),
      dateISO: z
        .string()
        .describe("Event start time as ISO 8601 string (UTC or with offset)"),
      venue: z.string().optional().describe("Venue / location text"),
      accentHex: z
        .string()
        .optional()
        .describe("Hex color for accent (e.g. '#ef4444'). Defaults to indigo."),
      rsvpUrl: z
        .string()
        .optional()
        .describe("URL to encode in the event RSVP QR code"),
      durationHours: z
        .number()
        .optional()
        .describe("Event duration in hours (default 3)"),
      avatarStyle: z
        .enum(AVATAR_STYLES)
        .optional()
        .describe(
          "Avatar style for the whole crew. 'lorelei' = monochrome line art (default, calm/professional), 'notionists' = Notion-style sketch (friendly meetups), 'bottts' = colorful robots (hackathons / playful trading-card vibe), 'shapes' = abstract geometric (anonymous voting / ballots).",
        ),
      attendees: z
        .array(attendeeSchema)
        .min(1)
        .describe("Attendees to generate identity badges for"),
    },
    outputSchema: {
      event: z
        .object({
          title: z.string(),
          dateISO: z.string(),
          venue: z.string().nullable(),
          accentHex: z.string(),
          rsvpUrl: z.string().nullable(),
          avatarStyle: z.string(),
          icsString: z.string(),
          qrSvg: z.string(),
        })
        .describe("Event card data (title, date, venue, accent, RSVP QR, .ics)"),
      badges: z
        .array(
          z.object({
            name: z.string(),
            role: z.string(),
            gender: z.string().nullable(),
            avatarSvg: z.string(),
            vcardQrSvg: z.string(),
          }),
        )
        .describe("One identity badge per attendee"),
    },
    annotations: {
      title: "Generate an event Lineup",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    _meta: {
      "openai/toolInvocation/invoking": "Building your Lineup…",
      "openai/toolInvocation/invoked": "Lineup ready.",
    },
    view: {
      component: "generate-lineup",
      description: "Event card + identity badge grid",
      csp: {
        resourceDomains: [
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
        ],
        redirectDomains: [],
      },
    },
  },
  async ({
    title,
    dateISO,
    venue,
    accentHex,
    rsvpUrl,
    durationHours,
    avatarStyle,
    attendees,
  }) => {
    const accent = accentHex ?? "#6366f1";
    const style = avatarStyle ?? DEFAULT_AVATAR_STYLE;
    const icsString = buildIcs({ title, dateISO, venue, durationHours });
    const eventQrPayload = rsvpUrl ?? `EVENT:${title}`;
    const eventQrSvg = await generateQrSvg(eventQrPayload, accent);

    const badges = await Promise.all(
      attendees.map(async ({ name, role, gender }) => {
        const avatarSvg = generateAvatarSvg(name, style, gender);
        const vcard = buildVcard({ name, role, eventTitle: title });
        const vcardQrSvg = await generateQrSvg(vcard, "#111111");
        return { name, role: role ?? "Guest", gender: gender ?? null, avatarSvg, vcardQrSvg };
      }),
    );

    const structuredContent = {
      event: {
        title,
        dateISO,
        venue: venue ?? null,
        accentHex: accent,
        rsvpUrl: rsvpUrl ?? null,
        avatarStyle: style,
        icsString,
        qrSvg: eventQrSvg,
      },
      badges,
    };

    const summary = `Lineup ready: "${title}" with ${badges.length} ${
      badges.length === 1 ? "badge" : "badges"
    }${venue ? ` at ${venue}` : ""}.`;

    return {
      structuredContent,
      content: [{ type: "text", text: summary }],
      isError: false,
    };
  },
).registerTool(
  {
    name: "render-badge-png",
    description:
      "Render a single identity badge as a shareable PNG (avatar + name + role + vCard QR) composed with Satori. Called when the user downloads a badge.",
    inputSchema: {
      name: z.string().describe("Attendee full name"),
      role: z.string().optional().describe("Role label"),
      accentHex: z.string().optional().describe("Accent hex color"),
      eventTitle: z.string().optional().describe("Event title (printed on the badge)"),
      avatarStyle: z
        .enum(AVATAR_STYLES)
        .optional()
        .describe("Avatar style (same options as generate-lineup). Match the event's style."),
      seed: z
        .string()
        .optional()
        .describe("Avatar seed override (defaults to name). Used when the user re-rolled this face."),
      gender: z
        .enum(GENDERS)
        .optional()
        .describe("Gender hint (same as generate-lineup). Match the badge."),
    },
    outputSchema: {
      pngDataUrl: z
        .string()
        .describe("The rendered badge as a base64 PNG data URL"),
    },
    annotations: {
      title: "Download badge PNG",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    _meta: {
      "openai/toolInvocation/invoking": "Rendering badge…",
      "openai/toolInvocation/invoked": "Badge ready.",
    },
  },
  async ({ name, role, accentHex, eventTitle, avatarStyle, seed, gender }) => {
    const pngDataUrl = await renderBadgePng({ name, role, accentHex, eventTitle, avatarStyle, seed, gender });
    return {
      structuredContent: { pngDataUrl },
      content: [{ type: "text", text: `Rendered badge PNG for ${name}.` }],
      isError: false,
    };
  },
);

if (process.env.NODE_ENV === "production") {
  const { default: manifest } = await import("./vite-manifest.js");
  server.setViteManifest(manifest);
}

// ── Legacy template absorber ────────────────────────────────────────────────
// Skybridge advertises a content-hashed view URI (…html?v=<hash>) and the server
// only serves the *current* hash. After any view change + redeploy, ChatGPT (and
// other Apps SDK hosts) messages that cached an older hash fail to render with
// "Failed to fetch template" — the stale URI now 404s. Per the OpenAI Apps SDK
// best practice (stable advertised URI + a ResourceTemplate that absorbs legacy
// versioned URIs), we register non-listed catch-all templates that delegate to
// the current registered handler, so previously-rendered widgets re-resolve to
// the latest content instead of breaking. New tool calls keep using the exact
// current URI (which wins via exact-match), so this is purely additive.
{
  const registry = (
    server as unknown as {
      _registeredResources: Record<
        string,
        { readCallback: (uri: URL, extra: unknown) => unknown }
      >;
    }
  )._registeredResources;

  const currentHandlerFor = (base: string) =>
    Object.entries(registry).find(([uri]) => uri.startsWith(base))?.[1]
      ?.readCallback;

  const absorbLegacy = (name: string, base: string) => {
    const handler = currentHandlerFor(base);
    if (!handler) return; // dev / no production hash → nothing to absorb
    // `{?v}` matches both the unversioned URI and any prior ?v=<hash>.
    server.registerResource(
      name,
      new ResourceTemplate(`${base}{?v}`, { list: undefined }),
      {},
      ((uri: URL, _vars: unknown, extra: unknown) =>
        handler(uri, extra)) as never,
    );
  };

  absorbLegacy(
    "generate-lineup-apps-legacy",
    "ui://views/apps-sdk/generate-lineup.html",
  );
  absorbLegacy(
    "generate-lineup-ext-legacy",
    "ui://views/ext-apps/generate-lineup.html",
  );
}

export default await server.run();

export type AppType = typeof server;
