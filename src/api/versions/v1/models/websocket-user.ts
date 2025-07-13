import { WSContext } from "hono/ws";
import { AuthenticationUtils } from "../../../utils/authentication-utils.ts";

export class WebSocketUser {
  private id: string;
  private userToken: string;
  private hostToken: string | null = null;
  private name: string;
  private connectedTimestamp: number;
  private webSocket: WSContext<WebSocket> | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.userToken = AuthenticationUtils.generateToken();
    this.connectedTimestamp = Date.now();
  }

  public getId(): string {
    return this.id;
  }

  public getUserToken(): string {
    return this.userToken;
  }

  public getHostToken(): string | null {
    return this.hostToken;
  }

  public setHostToken(token: string | null): void {
    this.hostToken = token;
  }

  public getName(): string {
    return this.name;
  }

  public getConnectedTimestamp(): number {
    return this.connectedTimestamp;
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
      userToken: this.userToken,
      hostToken: this.hostToken,
      name: this.name,
      connectedTimestamp: this.connectedTimestamp,
    });
  }
}
