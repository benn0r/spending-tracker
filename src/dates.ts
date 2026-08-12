export function formatLocalDate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Cannot format an invalid date.');
  const year = date.getFullYear();
  if (year < 0 || year > 9999) throw new RangeError('Date year must be between 0000 and 9999.');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date | null {
  const parts = parseCalendarDate(value);
  if (!parts) return null;
  const { year, month, day } = parts;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function parseCalendarDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(12, 0, 0, 0);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isLocalDate(value: string): boolean {
  return parseCalendarDate(value) !== null;
}
