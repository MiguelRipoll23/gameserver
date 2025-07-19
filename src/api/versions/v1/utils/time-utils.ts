export type DurationUnit =
  | "minutes"
  | "hours"
  | "weeks"
  | "months"
  | "years";

export class TimeUtils {
  private static readonly unitMap: Record<DurationUnit, number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };

  public static getRelativeTimestamp(
    value: number,
    unit: DurationUnit,
  ): number {
    const multiplier = TimeUtils.unitMap[unit];
    const relativeMs = value * multiplier;
    if (relativeMs > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Relative time overflow: ${value}${unit}`);
    }

    const timestamp = Date.now() + relativeMs;
    if (timestamp > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Relative time overflow: ${value}${unit}`);
    }

    return timestamp;
  }
}
