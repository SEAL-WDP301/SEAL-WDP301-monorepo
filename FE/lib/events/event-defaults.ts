export function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export const DEFAULT_EVENT_DURATION_DAYS = 4;

export function addDaysToLocalDateTimeValue(value: string, days: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return toLocalDateTimeValue(date);
}

export function createDefaultRoundDeadlines(startDate: string, endDate: string) {
  const finalDeadline = new Date(endDate);
  finalDeadline.setHours(finalDeadline.getHours() - 1);

  return {
    firstRoundDeadline: addDaysToLocalDateTimeValue(startDate, 2),
    finalRoundDeadline: toLocalDateTimeValue(finalDeadline),
  };
}

export function createDefaultEventSchedule(now = new Date()) {
  const atLocalTime = (daysFromNow: number, hours: number, minutes = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hours, minutes, 0, 0);
    return toLocalDateTimeValue(date);
  };

  const startDate = atLocalTime(8, 8);
  const endDate = addDaysToLocalDateTimeValue(
    startDate,
    DEFAULT_EVENT_DURATION_DAYS,
  );

  return {
    registrationDeadline: atLocalTime(7, 23, 59),
    startDate,
    endDate,
    ...createDefaultRoundDeadlines(startDate, endDate),
  };
}

export function getEventSeason(date: Date): "Spring" | "Summer" | "Fall" {
  const month = date.getMonth() + 1;
  if (month <= 4) return "Spring";
  if (month <= 8) return "Summer";
  return "Fall";
}
