import { createEvent, type EventAttributes, type DateArray } from "ics";

export function buildIcs(args: {
  title: string;
  dateISO: string;
  venue?: string;
  durationHours?: number;
}): string {
  const { title, dateISO, venue, durationHours = 3 } = args;
  const start = new Date(dateISO);
  const startArr: DateArray = [
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
    start.getUTCHours(),
    start.getUTCMinutes(),
  ];
  const event: EventAttributes = {
    title,
    location: venue,
    start: startArr,
    startInputType: "utc",
    duration: { hours: durationHours },
  };
  const { error, value } = createEvent(event);
  if (error || !value) throw error ?? new Error("ics failed");
  return value;
}
