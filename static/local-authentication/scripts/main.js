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

playerIdDialogElement.showModal();

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
    if (!validateDisplayName(name)) return;

    await credentialService.createCredential(name, name);
  } catch (error) {
    handleCredentialError(error);
  }
}

function handleDisplayNameInput() {
  registerButtonElement.disabled = !displayNameInputElement.value.trim();
}

function handleWebSocketConnection(event) {
  const { status } = event.detail;

  if (status === "authenticated") {
    alert("Return to game");
  } else if (status === "error") {
    alert("Connection to game client failed");
    enableButtons();
  }
}

function handleAuthenticationSuccess(event) {
  websocketService.connectAndSendAuthenticationResponse(event.detail);
}

function validateDisplayName(name) {
  if (!name) {
    enableButtons();
    return false;
  }

  return true;
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
    alert(error.message);
  } else {
    alert("An unexpected error occurred");
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
