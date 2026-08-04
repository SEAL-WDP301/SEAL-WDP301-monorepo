export function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function createDefaultEventSchedule(now = new Date()) {
  const atLocalTime = (daysFromNow: number, hours: number, minutes = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hours, minutes, 0, 0);
    return toLocalDateTimeValue(date);
  };

  return {
    registrationDeadline: atLocalTime(7, 23, 59),
    startDate: atLocalTime(8, 8),
    endDate: atLocalTime(10, 17),
    roundDeadline: atLocalTime(10, 16),
  };
}

export function getEventSeason(date: Date): "Spring" | "Summer" | "Fall" {
  const month = date.getMonth() + 1;
  if (month <= 4) return "Spring";
  if (month <= 8) return "Summer";
  return "Fall";
}
