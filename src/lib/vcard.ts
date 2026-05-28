export function buildVcard(args: {
  name: string;
  role?: string;
  eventTitle?: string;
}): string {
  const { name, role, eventTitle } = args;
  const [first, ...rest] = name.split(" ");
  const last = rest.join(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:${last};${first};;;`,
    role ? `TITLE:${role}` : null,
    eventTitle ? `NOTE:Met at ${eventTitle}` : null,
    "END:VCARD",
  ].filter(Boolean) as string[];
  return lines.join("\r\n");
}
