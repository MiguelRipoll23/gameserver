export class BinaryWriter {
  private buffer: ArrayBuffer;
  private dataView: DataView;
  private uint8View: Uint8Array;
  private position: number;
  private encoder: TextEncoder;
  private littleEndian: boolean;

  public constructor(initialSize = 1024, littleEndian = true) {
    this.buffer = new ArrayBuffer(initialSize);
    this.dataView = new DataView(this.buffer);
    this.uint8View = new Uint8Array(this.buffer);
    this.position = 0;
    this.encoder = new TextEncoder();
    this.littleEndian = littleEndian;
  }

  public static build(initialSize = 1024, littleEndian = true): BinaryWriter {
    return new BinaryWriter(initialSize, littleEndian);
  }

  private ensureCapacity(size: number): void {
    const required = this.position + size;
    if (required > this.buffer.byteLength) {
      let newLength = this.buffer.byteLength * 2;
      while (newLength < required) {
        newLength *= 2;
      }
      const newBuffer = new ArrayBuffer(newLength);
      new Uint8Array(newBuffer).set(this.uint8View.subarray(0, this.position));
      this.buffer = newBuffer;
      this.dataView = new DataView(this.buffer);
      this.uint8View = new Uint8Array(this.buffer);
    }
  }

  public byte(value: number): this {
    this.ensureCapacity(1);
    this.dataView.setUint8(this.position++, value);
    return this;
  }

  public bytes(values: number[] | Uint8Array, size?: number): this {
    const array =
      values instanceof Uint8Array ? values : Uint8Array.from(values);
    const writeSize = size ?? array.length;
    this.ensureCapacity(writeSize);
    this.uint8View.set(array.subarray(0, writeSize), this.position);
    this.position += writeSize;
    return this;
  }

  public arrayBuffer(buffer: ArrayBuffer): this {
    const arr = new Uint8Array(buffer);
    this.ensureCapacity(arr.length);
    this.uint8View.set(arr, this.position);
    this.position += arr.length;
    return this;
  }

  public signedInt8(value: number): this {
    this.ensureCapacity(1);
    this.dataView.setInt8(this.position++, value);
    return this;
  }

  public unsignedInt8(value: number): this {
    this.ensureCapacity(1);
    this.dataView.setUint8(this.position++, value);
    return this;
  }

  public signedInt16(value: number): this {
    this.ensureCapacity(2);
    this.dataView.setInt16(this.position, value, this.littleEndian);
    this.position += 2;
    return this;
  }

  public unsignedInt16(value: number): this {
    this.ensureCapacity(2);
    this.dataView.setUint16(this.position, value, this.littleEndian);
    this.position += 2;
    return this;
  }

  public signedInt32(value: number): this {
    this.ensureCapacity(4);
    this.dataView.setInt32(this.position, value, this.littleEndian);
    this.position += 4;
    return this;
  }

  public unsignedInt32(value: number): this {
    this.ensureCapacity(4);
    this.dataView.setUint32(this.position, value, this.littleEndian);
    this.position += 4;
    return this;
  }

  public float32(value: number): this {
    this.ensureCapacity(4);
    this.dataView.setFloat32(this.position, value, this.littleEndian);
    this.position += 4;
    return this;
  }

  public float64(value: number): this {
    this.ensureCapacity(8);
    this.dataView.setFloat64(this.position, value, this.littleEndian);
    this.position += 8;
    return this;
  }

  public boolean(value: boolean): this {
    return this.byte(value ? 1 : 0);
  }

  public fixedLengthString(text: string, length: number): this {
    const encoded = this.encoder.encode(text);
    this.ensureCapacity(length);
    const len = Math.min(encoded.length, length);

    this.uint8View.set(encoded.subarray(0, len), this.position);
    this.uint8View.fill(0, this.position + len, this.position + length);
    this.position += length;
    return this;
  }

  public variableLengthString(text: string): this {
    const encoded = this.encoder.encode(text);
    this.unsignedInt32(encoded.length);
    this.ensureCapacity(encoded.length);
    this.uint8View.set(encoded, this.position);
    this.position += encoded.length;
    return this;
  }

  public toUint8Array(): Uint8Array {
    return this.uint8View.subarray(0, this.position);
  }

  public toArrayBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.position);
  }
}
