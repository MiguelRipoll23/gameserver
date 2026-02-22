import { injectable } from "@needle-di/core";
import { WebSocketUser } from "../models/websocket-user.ts";

@injectable()
export class WebSocketUserRegistry {
  private usersById: Map<string, WebSocketUser> = new Map();
  private usersByToken: Map<string, WebSocketUser> = new Map();

  add(user: WebSocketUser): void {
    const existing = this.usersById.get(user.getId());
    if (existing && existing !== user) {
      this.usersByToken.delete(existing.getToken());
    }

    this.usersById.set(user.getId(), user);
    this.usersByToken.set(user.getToken(), user);
  }

  remove(user: WebSocketUser): void {
    this.usersById.delete(user.getId());
    this.usersByToken.delete(user.getToken());
  }

  getById(id: string): WebSocketUser | undefined {
    return this.usersById.get(id);
  }

  getByToken(token: string): WebSocketUser | undefined {
    return this.usersByToken.get(token);
  }

  valuesById(): IterableIterator<WebSocketUser> {
    return this.usersById.values();
  }

  valuesByToken(): IterableIterator<WebSocketUser> {
    return this.usersByToken.values();
  }
}

export default WebSocketUserRegistry;
