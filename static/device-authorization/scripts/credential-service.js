import { APIService } from "./api-service.js";

export class CredentialService {
  constructor(apiService = new APIService()) {
    this.apiService = apiService;
  }

  async getCredential() {
    const transactionId = crypto.randomUUID();
    const authenticationOptionsRequest = { transactionId };

    const authenticationOptions =
      await this.apiService.getAuthenticationOptions(
        authenticationOptionsRequest
      );

    const publicKey = {
      ...authenticationOptions,
      challenge: this.base64UrlToArrayBuffer(authenticationOptions.challenge),
      allowCredentials: authenticationOptions.allowCredentials?.map(
        (credential) => ({
          ...credential,
          id: this.base64UrlToArrayBuffer(credential.id),
        })
      ),
    };

    let credential;

    try {
      credential = await navigator.credentials.get({ publicKey });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "NotAllowedError")
      ) {
        console.log("User cancelled credential request");
        return null;
      }

      console.error("Unexpected error during credential request:", error);
      throw error;
    }

    if (credential === null || credential === undefined) {
      console.log("No credential returned");
      return null;
    }

    const verifyAuthenticationRequest = {
      transactionId,
      authenticationResponse: this.serializeCredential(credential),
    };

    const response = await this.apiService.verifyAuthenticationResponse(
      verifyAuthenticationRequest
    );

    this.handleAuthenticationResponse(response);
  }

  handleAuthenticationResponse(response) {
    const event = new CustomEvent("authentication-success", {
      detail: response,
    });

    document.dispatchEvent(event);

    console.log("Authentication event dispatched");
  }

  arrayBufferToBase64Url(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  base64UrlToArrayBuffer(base64url) {
    base64url = base64url.replace(/-/g, "+").replace(/_/g, "/");
    base64url += "=".repeat((4 - (base64url.length % 4)) % 4);
    const binary = atob(base64url);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  serializeCredential(credential) {
    const { type, rawId, response } = credential;

    return {
      id: this.arrayBufferToBase64Url(rawId),
      type,
      rawId: this.arrayBufferToBase64Url(rawId),
      response: {
        clientDataJSON: this.arrayBufferToBase64Url(response.clientDataJSON),
        authenticatorData: response.authenticatorData
          ? this.arrayBufferToBase64Url(response.authenticatorData)
          : null,
        signature: response.signature
          ? this.arrayBufferToBase64Url(response.signature)
          : null,
        userHandle: response.userHandle
          ? this.arrayBufferToBase64Url(response.userHandle)
          : null,
      },
    };
  }
}
