/**
 * Logger - a console abstraction for Cloudflare Workers.
 *
 * `console` formatting can be unreliable in the Workers runtime (e.g. objects
 * printed as `[object Object]` or colored text leaking into structured logs),
 * so every log call is normalized before reaching `console`:
 *
 * - ANSI escape codes (colored text) are stripped from strings.
 * - Objects are stringified with `JSON.stringify` (safe for BigInt and
 *   circular references).
 * - `Error` instances are reduced to their (ANSI-free) stack trace.
 *
 * Note: `console` format specifiers (`%s`, `%d`, `%o`, ...) still apply when the
 * first argument is a string containing them and more arguments follow. Prefer
 * template literals to avoid surprises.
 */
type LoggerLevel = "debug" | "log" | "info" | "warn" | "error" | "trace";

export class Logger {
  public static debug(...args: unknown[]): void {
    Logger.write("debug", args);
  }

  public static log(...args: unknown[]): void {
    Logger.write("log", args);
  }

  public static info(...args: unknown[]): void {
    Logger.write("info", args);
  }

  public static warn(...args: unknown[]): void {
    Logger.write("warn", args);
  }

  public static error(...args: unknown[]): void {
    Logger.write("error", args);
  }

  public static trace(...args: unknown[]): void {
    Logger.write("trace", args);
  }

  private static write(level: LoggerLevel, args: unknown[]): void {
    const formatted = args.map(Logger.format);
    const consoleLike = console as unknown as {
      [method in LoggerLevel]: (...args: unknown[]) => void;
    };
    consoleLike[level](...formatted);
  }

  private static format(value: unknown): unknown {
    if (typeof value === "string") {
      return Logger.stripAnsi(value);
    }

    if (value instanceof Error) {
      return Logger.stripAnsi(value.stack ?? value.message);
    }

    if (typeof value === "object" && value !== null) {
      try {
        return JSON.stringify(value, Logger.replacer);
      } catch {
        return String(value);
      }
    }

    return value;
  }

  private static replacer(_key: string, value: unknown): unknown {
    if (typeof value === "bigint") {
      return value.toString();
    }

    if (typeof value === "string") {
      return Logger.stripAnsi(value);
    }

    return value;
  }

  private static stripAnsi(text: string): string {
    return text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
  }
}
