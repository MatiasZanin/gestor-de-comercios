export const ART_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function formatArtDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ART_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function formatArtMonth(iso: string): string {
  return formatArtDay(iso).slice(0, 7);
}

export function formatArtHour(iso: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ART_TIME_ZONE,
      hour: 'numeric',
      hour12: false,
    }).format(new Date(iso)),
    10
  );
}

export function isoFromArtDateTime(
  day: string,
  hour: number,
  minute: number,
  second = 0,
  millisecond = 0
): string {
  const [year, month, date] = day.split('-').map(Number);
  const utcHour = hour + 3;
  return new Date(Date.UTC(year, month - 1, date, utcHour, minute, second, millisecond)).toISOString();
}

export function startOfArtDayIso(day: string): string {
  return isoFromArtDateTime(day, 0, 0, 0, 0);
}

export function endOfArtDayIso(day: string): string {
  return isoFromArtDateTime(day, 23, 59, 59, 999);
}
