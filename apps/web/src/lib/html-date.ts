import { parseISO } from "date-fns";
import * as z from "zod";

/** `datetime-local` value (`YYYY-MM-DDTHH:mm`) in the viewer's timezone. */
function toDatetimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function utcCalendarDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * `<input type="date">` (`YYYY-MM-DD`) ↔ ISO instant (UTC midnight).
 * Use `.encode` for defaultValues and let the resolver `.decode` on submit.
 */
export const htmlDate = z.codec(z.iso.date({ error: "Pick a date" }), z.string(), {
  decode: (ymd) => `${ymd}T00:00:00.000Z`,
  encode: (iso) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    return utcCalendarDate(parseISO(iso));
  },
});

/**
 * `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`) ↔ ISO instant.
 */
export const htmlDateTime = z.codec(z.string().min(1, "Pick a date and time"), z.string(), {
  decode: (local) => parseISO(local).toISOString(),
  encode: (iso) => toDatetimeLocalValue(parseISO(iso)),
});

/**
 * Optional event time: empty means "now" (`null`), a filled picker is epoch ms.
 */
export const optionalHtmlDateTime = z.codec(z.string(), z.number().nullable(), {
  decode: (value, payload) => {
    if (value === "") return null;
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      payload.issues.push({
        code: "custom",
        input: value,
        message: "Pick a valid time — or leave it blank for now",
      });
      return z.NEVER;
    }
    return ms;
  },
  encode: (ms) => (ms == null ? "" : toDatetimeLocalValue(new Date(ms))),
});

/** `datetime-local` max/default for "now" in the viewer's timezone. */
export function htmlDateTimeNow(): string {
  return toDatetimeLocalValue(new Date());
}
