export class WebSocketService {
  static WEBSOCKET_PORT = 3000;
  static WEBSOCKET_URL = `ws://localhost:${this.WEBSOCKET_PORT}`;

  constructor() {
    this.webSocket = null;
    this.disconnectedGracefully = false;

    this.handleOpenEvent = this.handleOpenEvent.bind(this);
    this.handleCloseEvent = this.handleCloseEvent.bind(this);
    this.handleErrorEvent = this.handleErrorEvent.bind(this);
  }

  connect() {
    if (this.isConnected()) return;

    this.disconnectedGracefully = false;

    try {
      this.webSocket = new WebSocket(WebSocketService.WEBSOCKET_URL);

      this.webSocket.addEventListener("open", this.handleOpenEvent);
      this.webSocket.addEventListener("close", this.handleCloseEvent);
      this.webSocket.addEventListener("error", this.handleErrorEvent);
    } catch (error) {
      this.dispatchConnectionEvent("error", { error });
    }
  }

  handleOpenEvent() {
    this.dispatchConnectionEvent("connected");
  }

  handleCloseEvent(event) {
    const status = this.disconnectedGracefully
      ? "disconnected-gracefully"
      : "disconnected";
    this.dispatchConnectionEvent(status, { event });
  }

  handleErrorEvent(event) {
    this.dispatchConnectionEvent("error", { event });
  }

  isConnected() {
    return this.webSocket?.readyState === WebSocket.OPEN;
  }

  sendMessage(data) {
    if (this.isConnected()) {
      this.webSocket.send(JSON.stringify(data));
    } else {
      console.warn("Tried to send before connection was open:", data);
    }
  }

  sendAuthenticationResponse(authenticationResponse) {
    if (this.isConnected()) {
      this.sendMessage(authenticationResponse);
      return;
    }

    if (!this.webSocket || this.webSocket.readyState === WebSocket.CLOSED) {
      this.connect();
    }

    this.webSocket.addEventListener(
      "open",
      () => this.sendMessage(authenticationResponse),
      { once: true }
    );
  }

  closeConnection() {
    if (this.webSocket) {
      this.disconnectedGracefully = true;
      this.cleanupListeners();
      this.webSocket.close();
    }
  }

  cleanupListeners() {
    if (!this.webSocket) return;
    this.webSocket.removeEventListener("open", this.handleOpenEvent);
    this.webSocket.removeEventListener("close", this.handleCloseEvent);
    this.webSocket.removeEventListener("error", this.handleErrorEvent);
  }

  dispatchConnectionEvent(status, detail = {}) {
    document.dispatchEvent(
      new CustomEvent("websocket-connection", { detail: { status, ...detail } })
    );
  }
}
