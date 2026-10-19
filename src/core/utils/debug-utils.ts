export class DebugUtils {
  public static getHexDump(
    uint8: Uint8Array,
    bytesPerLine: number = 24,
  ): string {
    const lines: string[] = [];
    for (let i = 0; i < uint8.length; i += bytesPerLine) {
      const chunk = Array.from(uint8.slice(i, i + bytesPerLine));
      const hex = chunk
        .map(
          (b, j) =>
            b.toString(16).padStart(2, "0") + ((j + 1) % 8 === 0 ? "  " : " "),
        )
        .join("")
        .padEnd(bytesPerLine * 3 + Math.floor(bytesPerLine / 8), " ");
      const ascii = chunk
        .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
        .join("");
      lines.push(`${i.toString(16).padStart(4, "0")}: ${hex} ${ascii}`);
    }
    return lines.join("\n");
  }
}
