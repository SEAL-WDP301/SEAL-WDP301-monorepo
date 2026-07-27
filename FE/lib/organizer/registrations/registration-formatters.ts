export const formatRegistrationNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
export const formatRegistrationDate = (value: string) => new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));
