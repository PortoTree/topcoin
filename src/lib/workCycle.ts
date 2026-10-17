/**
 * Helper to calculate active work cycle date based on the configured reset time (e.g. 07:00 AM)
 */

export interface ResetTimeConfig {
  reset_hour: number;
  reset_minute: number;
}

export const DEFAULT_RESET_TIME: ResetTimeConfig = {
  reset_hour: 7,
  reset_minute: 0,
};

/**
 * Returns YYYY-MM-DD for the current active work cycle.
 * If current time is before the reset time, returns the previous date.
 */
export function getCurrentWorkDate(
  now = new Date(),
  config: ResetTimeConfig = DEFAULT_RESET_TIME
): string {
  const d = new Date(now);
  const resetMinutes = config.reset_hour * 60 + config.reset_minute;
  const currentMinutes = d.getHours() * 60 + d.getMinutes();

  if (currentMinutes < resetMinutes) {
    // Falls under previous working cycle
    d.setDate(d.getDate() - 1);
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Calculates timestamp of next upcoming reset time
 */
export function getNextResetTimestamp(
  now = new Date(),
  config: ResetTimeConfig = DEFAULT_RESET_TIME
): number {
  const next = new Date(now);
  next.setHours(config.reset_hour, config.reset_minute, 0, 0);

  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}
