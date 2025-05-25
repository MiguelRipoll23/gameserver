import { WSContext } from "hono/ws";
import { AuthenticationUtils } from "../../../utils/authentication-utils.ts";

export class WebSocketUser {
  private id: string;
  private token: string;
  private name: string;
  private connectedTimestamp: number;
  private messageTimestamps: number[];

  private webSocket: WSContext<WebSocket> | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.token = AuthenticationUtils.generateToken();
    this.connectedTimestamp = Date.now();
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

  public getConnectedTimestamp(): number {
    return this.connectedTimestamp;
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

  public serialize(): string {
    return JSON.stringify({
      id: this.id,
      token: this.token,
      name: this.name,
      connectedTimestamp: this.connectedTimestamp,
      messageTimestamps: this.messageTimestamps,
    });
  }
}
