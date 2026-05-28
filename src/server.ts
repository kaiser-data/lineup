import { McpServer } from "skybridge/server";
import { z } from "zod";
import { generateAvatarSvg } from "./lib/avatars.js";
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
      attendees: z
        .array(attendeeSchema)
        .min(1)
        .describe("Attendees to generate identity badges for"),
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
      domain: "https://skybridge.tech",
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
    attendees,
  }) => {
    const accent = accentHex ?? "#6366f1";
    const icsString = buildIcs({ title, dateISO, venue, durationHours });
    const eventQrPayload = rsvpUrl ?? `EVENT:${title}`;
    const eventQrSvg = await generateQrSvg(eventQrPayload, accent);

    const badges = await Promise.all(
      attendees.map(async ({ name, role }) => {
        const avatarSvg = generateAvatarSvg(name);
        const vcard = buildVcard({ name, role, eventTitle: title });
        const vcardQrSvg = await generateQrSvg(vcard, "#111111");
        return { name, role: role ?? "Guest", avatarSvg, vcardQrSvg };
      }),
    );

    const structuredContent = {
      event: {
        title,
        dateISO,
        venue: venue ?? null,
        accentHex: accent,
        rsvpUrl: rsvpUrl ?? null,
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
  async ({ name, role, accentHex, eventTitle }) => {
    const pngDataUrl = await renderBadgePng({ name, role, accentHex, eventTitle });
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

export default await server.run();

export type AppType = typeof server;
