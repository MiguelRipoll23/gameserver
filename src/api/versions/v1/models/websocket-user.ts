import { WSContext } from "hono/ws";
import { AuthenticationUtils } from "../../../utils/authentication-utils.ts";

export class WebSocketUser {
  private id: string;
  private networkId: string;
  private sessionId: string;
  private hostSessionId: string | null = null;
  private name: string;
  private connectedTimestamp: number;
  private webSocket: WSContext<WebSocket> | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.networkId = id.replaceAll("-", "");
    this.name = name;
    this.sessionId = AuthenticationUtils.generateSessionId();
    this.connectedTimestamp = Date.now();
  }

  public getId(): string {
    return this.id;
  }

  public getNetworkId(): string {
    return this.networkId;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getHostSessionId(): string | null {
    return this.hostSessionId;
  }

  public setHostSessionId(sessionId: string | null): void {
    this.hostSessionId = sessionId;
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
      userToken: this.sessionId,
      hostToken: this.hostSessionId,
      name: this.name,
      connectedTimestamp: this.connectedTimestamp,
    });
  }
}
