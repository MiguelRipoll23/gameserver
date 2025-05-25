import { DebugUtils } from "./debug-utils.ts";

export class BinaryReader {
  private readonly buffer: ArrayBuffer;
  private readonly dataView: DataView;
  private readonly uint8: Uint8Array;
  private position: number = 0;
  private readonly decoder = new TextDecoder();
  private readonly littleEndian: boolean;
  private readonly bufferLength: number;

  private constructor(buffer: ArrayBuffer, littleEndian = true) {
    this.buffer = buffer;
    this.dataView = new DataView(buffer);
    this.uint8 = new Uint8Array(buffer);
    this.littleEndian = littleEndian;
    this.bufferLength = buffer.byteLength;
  }

  public static fromArrayBuffer(
    buffer: ArrayBuffer,
    littleEndian = true
  ): BinaryReader {
    return new BinaryReader(buffer, littleEndian);
  }

  public static fromUint8Array(
    array: Uint8Array,
    littleEndian = true
  ): BinaryReader {
    const subArray = array.subarray(0, array.byteLength);
    return new BinaryReader(subArray.buffer as ArrayBuffer, littleEndian);
  }

  public byte(): number {
    return this.uint8[this.position++];
  }

  public bytes(length: number): Uint8Array {
    const start = this.position;
    this.position += length;
    return this.uint8.subarray(start, this.position);
  }

  public bytesAsUint8Array(): Uint8Array {
    return this.uint8.subarray(this.position);
  }

  public bytesAsArrayBuffer(): ArrayBuffer {
    return this.buffer.slice(this.position, this.bufferLength);
  }

  public signedInt8(): number {
    return this.dataView.getInt8(this.position++);
  }

  public unsignedInt8(): number {
    return this.dataView.getUint8(this.position++);
  }

  public signedInt16(): number {
    const val = this.dataView.getInt16(this.position, this.littleEndian);
    this.position += 2;
    return val;
  }

  public unsignedInt16(): number {
    const val = this.dataView.getUint16(this.position, this.littleEndian);
    this.position += 2;
    return val;
  }

  public signedInt32(): number {
    const val = this.dataView.getInt32(this.position, this.littleEndian);
    this.position += 4;
    return val;
  }

  public unsignedInt32(): number {
    const val = this.dataView.getUint32(this.position, this.littleEndian);
    this.position += 4;
    return val;
  }

  public float32(): number {
    const val = this.dataView.getFloat32(this.position, this.littleEndian);
    this.position += 4;
    return val;
  }

  public float64(): number {
    const val = this.dataView.getFloat64(this.position, this.littleEndian);
    this.position += 8;
    return val;
  }

  public boolean(): boolean {
    return this.byte() !== 0;
  }

  public fixedLengthString(length: number): string {
    const bytes = this.uint8.subarray(this.position, this.position + length);
    this.position += length;
    const end = bytes.indexOf(0);
    return this.decoder.decode(end === -1 ? bytes : bytes.subarray(0, end));
  }

  public variableLengthString(): string {
    const length = this.unsignedInt32();
    const bytes = this.uint8.subarray(this.position, this.position + length);
    this.position += length;
    return this.decoder.decode(bytes);
  }

  public preview(bytesPerLine: number = 24): string {
    return DebugUtils.getHexDump(this.uint8, bytesPerLine);
  }
}
