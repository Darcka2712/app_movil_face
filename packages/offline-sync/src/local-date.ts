// shortcut: device local time via getFullYear/Month/Date, no IANA tz —
// kiosk runs in one timezone, local calendar day is enough
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
