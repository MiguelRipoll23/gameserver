import { WSContext } from "hono/ws";
import { encodeBase64 } from "@std/encoding/base64";

export class WebSocketUser {
  private id: string;
  private token: string;
  private name: string;
  private timestamp: number;
  private messageTimestamps: number[];

  private webSocket: WSContext<WebSocket> | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.token = this.generateToken();
    this.name = name;
    this.timestamp = Date.now();
    this.messageTimestamps = [];
  }

  public getId(): string {
    return this.id;
  }

  public getToken(): string {
    return this.token;
  }

  public getName(): string {
    return this.name;
  }

  public getTimestamp(): number {
    return this.timestamp;
  }

  public getMessageTimestamps(): number[] {
    return this.messageTimestamps;
  }

  public setMessageTimestamps(timestamps: number[]): void {
    this.messageTimestamps = timestamps;
  }

  public getWebSocket(): WSContext<WebSocket> | null {
    return this.webSocket;
  }

  public setWebSocket(webSocket: WSContext<WebSocket> | null): void {
    this.webSocket = webSocket;
  }

  private generateToken(): string {
    const tokenBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32));

    return encodeBase64(tokenBytes);
  }
}
