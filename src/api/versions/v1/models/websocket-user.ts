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
  private authenticated: boolean = false;
  private claims: Record<string, unknown> | null = null;

  constructor(publicIp: string) {
    this.id = "unknown";
    this.networkId = "unknown";
    this.name = "unknown";
    this.publicIp = publicIp;
    this.token = AuthenticationUtils.generateToken();
    this.connectedTimestamp = Date.now();
  }

  public getId(): string {
    return this.id;
  }

  public setId(id: string): void {
    this.id = id;
    this.networkId = id.replaceAll("-", "");
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

  public setName(name: string): void {
    this.name = name;
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

  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  public setAuthenticated(authenticated: boolean): void {
    this.authenticated = authenticated;
  }

  public setClaims(claims: Record<string, unknown> | null): void {
    this.claims = claims;
  }

  public getClaims(): Record<string, unknown> | null {
    return this.claims;
  }

  public setToken(token: string): void {
    this.token = token;
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
