import { CredentialService } from "./credential-service.js";
import { APIService } from "./api-service.js";

const credentialService = new CredentialService();
const apiService = new APIService();

const dialogElement = document.getElementById("device-authorization-dialog");
const codeInputElement = document.getElementById("code-input");
const signInButtonElement = document.getElementById("sign-in-button");
const statusElement = document.getElementById("status");

signInButtonElement.addEventListener("click", handleSignIn);
document.addEventListener("authentication-success", handleAuthenticationSuccess);

dialogElement.showModal();

async function handleSignIn() {
  const code = codeInputElement.value.trim();
  if (!code) {
    statusElement.textContent = "Enter the authorization code.";
    return;
  }

  signInButtonElement.disabled = true;
  statusElement.textContent = "Waiting for your passkey…";

  try {
    const result = await credentialService.getCredential();

    if (result === null) {
      statusElement.textContent = "Sign-in cancelled.";
      enableSignIn();
    }
  } catch (error) {
    statusElement.textContent = "Error: " + (error.message || String(error));
    enableSignIn();
  }
}

async function handleAuthenticationSuccess(event) {
  const code = codeInputElement.value.trim();
  statusElement.textContent = "Verifying…";

  try {
    await apiService.completeDeviceAuthorization({
      code,
      accessToken: event.detail.accessToken,
      refreshToken: event.detail.refreshToken,
    });

    statusElement.textContent = "Signed in! You can close this tab.";
  } catch (error) {
    statusElement.textContent = "Error: " + (error.message || String(error));
    enableSignIn();
  }
}

function enableSignIn() {
  signInButtonElement.disabled = false;
}
