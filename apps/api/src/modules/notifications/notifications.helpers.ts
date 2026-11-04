import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  type Language,
  type NotificationChannel,
} from '@ap/shared-constants';
import { resources } from '@ap/shared-i18n';

/**
 * Returns current IST time components (hour, minute, date string YYYY-MM-DD)
 */
export function getISTTime(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateStr: string;
} {
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth() + 1;
  const day = istDate.getUTCDate();
  const hour = istDate.getUTCHours();
  const minute = istDate.getUTCMinutes();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hour, minute, dateStr };
}

/**
 * Checks if current time is within quiet hours (e.g. 22:00 to 07:00 IST).
 */
export function isInQuietHours(
  date: Date = new Date(),
  startStr: string = '22:00',
  endStr: string = '07:00',
): boolean {
  const { hour, minute } = getISTTime(date);
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);
  const startMinutes = (startH ?? 22) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 7) * 60 + (endM ?? 0);

  if (startMinutes > endMinutes) {
    // Overnight quiet hours, e.g. 22:00 to 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Calculates the exact UTC Date when the current/next quiet hours window ends.
 */
export function getNextQuietHoursEnd(
  date: Date = new Date(),
  endStr: string = '07:00',
): Date {
  const [endH, endM] = endStr.split(':').map(Number);
  const h = endH ?? 7;
  const m = endM ?? 0;

  const { year, month, day, hour } = getISTTime(date);

  // If we are >= 22, quiet hours end tomorrow morning at 07:00 IST
  let endDay = day;
  if (hour >= 20) {
    endDay += 1;
  }

  // Construct IST date
  // IST is UTC + 5:30, so UTC = IST - 5:30
  const istTargetMs = Date.UTC(year, month - 1, endDay, h, m, 0);
  const utcMs = istTargetMs - (5 * 60 + 30) * 60 * 1000;

  return new Date(utcMs);
}

/**
 * Interpolates template variables {{key}} in localized strings
 */
export function interpolate(template: string, params: Record<string, unknown> = {}): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    return params[key] !== undefined && params[key] !== null ? String(params[key]) : `{{${key}}}`;
  });
}

/**
 * Localizes a notification title and body using shared-i18n
 */
export function resolveNotificationText(
  titleKey: string,
  bodyKey: string,
  lang: Language = DEFAULT_LANGUAGE,
  data: Record<string, unknown> = {},
): { title: string; body: string } {
  const chosenLang = (LANGUAGES as Record<string, Language>)[lang?.toUpperCase()] ?? DEFAULT_LANGUAGE;
  const localeStrings = (resources as any)[chosenLang]?.notifications ?? (resources as any)[DEFAULT_LANGUAGE]?.notifications ?? {};

  const rawTitle = localeStrings[titleKey] || (resources as any)[DEFAULT_LANGUAGE]?.notifications?.[titleKey] || titleKey;
  const rawBody = localeStrings[bodyKey] || (resources as any)[DEFAULT_LANGUAGE]?.notifications?.[bodyKey] || bodyKey;

  return {
    title: interpolate(rawTitle, data),
    body: interpolate(rawBody, data),
  };
}

