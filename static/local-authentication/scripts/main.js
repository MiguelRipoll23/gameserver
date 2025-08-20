import { CredentialService } from "./credential-service.js";
import { WebSocketService } from "./websocket-service.js";

const credentialService = new CredentialService();
const websocketService = new WebSocketService();

const playerIdDialogElement = document.getElementById("player-id-dialog");
const displayNameInputElement = document.getElementById("display-name-input");
const registerButtonElement = document.getElementById("register-button");
const signInButtonElement = document.getElementById("sign-in-button");

signInButtonElement.addEventListener("click", handleSignIn);
registerButtonElement.addEventListener("click", handleRegister);
displayNameInputElement.addEventListener("input", handleDisplayNameInput);

document.addEventListener("websocket-connection", handleWebSocketConnection);
document.addEventListener(
  "authentication-success",
  handleAuthenticationSuccess
);

async function handleSignIn() {
  disableButtons();
  try {
    await credentialService.getCredential();
  } catch (error) {
    handleCredentialError(error);
  }
}

async function handleRegister() {
  disableButtons();
  try {
    const name = displayNameInputElement.value.trim();
    if (!name) {
      enableButtons();
      return;
    }
    await credentialService.createCredential(name, name);
  } catch (error) {
    handleCredentialError(error);
  }
}

function handleAuthenticationSuccess(event) {
  websocketService.sendAuthenticationResponse(event.detail);
}

function handleWebSocketConnection(event) {
  const { status } = event.detail;

  switch (status) {
    case "connected":
      alert("Return to game");
      break;
    case "error":
      alert("Connection to game client failed");
      enableButtons();
      break;
  }
}

function handleCredentialError(error) {
  if (error.message === "User canceled credential request") {
    enableButtons();
    return;
  }
  handleError(error);
}

function handleError(error) {
  if (error.code && error.message) {
    self.alert(error.message);
  } else {
    self.alert("An unexpected error occurred");
    console.error(error);
  }
  enableButtons();
}

function disableButtons() {
  signInButtonElement.disabled = true;
  registerButtonElement.disabled = true;
}

function enableButtons() {
  signInButtonElement.disabled = false;
  registerButtonElement.disabled = !displayNameInputElement.value.trim();
}

function handleDisplayNameInput() {
  registerButtonElement.disabled = !displayNameInputElement.value.trim();
}

playerIdDialogElement.showModal();
