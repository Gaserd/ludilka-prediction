import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function toDatetimeLocalValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

export function formatPercent(value: number | string) {
  return `${Number(value).toFixed(2).replace(/\.00$/, "")}%`;
}

export function buildSearchParamMessage(
  value: string | string[] | undefined,
  messages: Record<string, string>,
) {
  if (!value || Array.isArray(value)) {
    return null;
  }

  return messages[value] ?? null;
}
