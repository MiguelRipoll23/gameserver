export class TimeUtils {
  private static readonly unitMap: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    mo: 30 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };

  private static readonly objectUnitMap: Record<string, number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };

  public static parseRelativeTime(value: string): number {
    const match = value.match(/^([1-9]\d*)(mo|m|h|d|w|y)$/);
    if (!match) {
      throw new Error(`Invalid relative time format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multiplier = TimeUtils.unitMap[unit];
    const relativeMs = amount * multiplier;
    if (relativeMs > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Relative time overflow: ${value}`);
    }

    const timestamp = Date.now() + relativeMs;
    if (timestamp > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Relative time overflow: ${value}`);
    }

    return timestamp;
  }

  public static parseDuration(
    duration: { value: number; unit: string },
  ): number {
    const multiplier = TimeUtils.objectUnitMap[duration.unit];
    if (!multiplier) {
      throw new Error(`Invalid duration unit: ${duration.unit}`);
    }

    const relativeMs = duration.value * multiplier;
    if (relativeMs > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Relative time overflow: ${duration.value}${duration.unit}`,
      );
    }

    const timestamp = Date.now() + relativeMs;
    if (timestamp > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Relative time overflow: ${duration.value}${duration.unit}`,
      );
    }

    return timestamp;
  }
}
