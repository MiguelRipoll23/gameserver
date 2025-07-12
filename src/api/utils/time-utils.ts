export class TimeUtils {
  private static readonly unitMap: Record<string, number> = {
    min: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };

  public static parseRelativeTime(value: string): number {
    const match = value.match(/^([1-9]\d*)(min|h|d|w|m|y)$/);
    if (!match) {
      throw new Error(`Invalid relative time format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multiplier = TimeUtils.unitMap[unit];

    return Date.now() + amount * multiplier;
  }
}
