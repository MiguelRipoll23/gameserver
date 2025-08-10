import { WSContext } from "hono/ws";
import { AuthenticationUtils } from "../utils/authentication-utils.ts";

export class WebSocketUser {
  private id: string;
  private networkId: string;
  private token: string;
  private hostToken: string | null = null;
  private name: string;
  private publicIp: string;
  private connectedTimestamp: number;
  private webSocket: WSContext<WebSocket> | null = null;

  constructor(id: string, name: string, publicIp: string) {
    this.id = id;
    this.networkId = id.replaceAll("-", "");
    this.name = name;
    this.publicIp = publicIp;
    this.token = AuthenticationUtils.generateToken();
    this.connectedTimestamp = Date.now();
  }

  public getId(): string {
    return this.id;
  }

  public getNetworkId(): string {
    return this.networkId;
  }

  public getToken(): string {
    return this.token;
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

  public getPublicIp(): string {
    return this.publicIp;
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
      userToken: this.token,
      hostToken: this.hostToken,
      name: this.name,
      publicIp: this.publicIp,
      connectedTimestamp: this.connectedTimestamp,
    });
  }
}
