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
      challenge: this.base64UrlToArrayBuffer(authenticationOptions.challenge),
    };

    const credential = await navigator.credentials.get({ publicKey });

    if (credential === null) {
      throw new Error("User canceled credential request");
    }

    const verifyAuthenticationRequest = {
      transactionId,
      authenticationResponse: this.serializeCredential(credential),
    };

    try {
      const response = await this.apiService.verifyAuthenticationResponse(
        verifyAuthenticationRequest
      );
      await this.handleAuthenticationResponse(response);
    } catch (error) {
      if (this.isCredentialNotFoundError(error)) {
        this.signalUnknownCredential(authenticationOptions.rpId, credential.id);
      }
      throw error;
    }
  }

  async createCredential(name, displayName) {
    if (self.PublicKeyCredential === undefined) {
      throw new Error(
        "It looks like your browser or device doesn't support passkeys, which are required to play the game. Please try using a different browser or device."
      );
    }

    const transactionId = crypto.randomUUID();
    const registrationOptionsRequest = { transactionId, displayName };

    const registrationOptions = await this.apiService.getRegistrationOptions(
      registrationOptionsRequest
    );

    const challenge = registrationOptions.challenge;
    const encodedUserId = registrationOptions.user.id;
    const userId = this.base64UrlToString(encodedUserId);
    const pubKeyCredParams = registrationOptions.pubKeyCredParams;

    const publicKey = {
      ...registrationOptions,
      challenge: this.base64UrlToArrayBuffer(challenge),
      user: {
        id: new TextEncoder().encode(userId),
        name,
        displayName,
      },
      pubKeyCredParams: pubKeyCredParams.map((pkcp) => ({
        type: pkcp.type,
        alg: pkcp.alg,
      })),
    };

    const credential = await navigator.credentials.create({ publicKey });

    const verifyRegistrationRequest = {
      transactionId,
      registrationResponse: this.serializeCredential(credential),
    };

    const response = await this.apiService.verifyRegistration(
      verifyRegistrationRequest
    );
    await this.handleAuthenticationResponse(response);
  }

  isCredentialNotFoundError(error) {
    return error.code === "CREDENTIAL_NOT_FOUND";
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

  base64UrlToString(base64url) {
    return new TextDecoder().decode(this.base64UrlToArrayBuffer(base64url));
  }

  // WebAuthn Utility Methods
  serializeCredential(credential) {
    const { type, rawId, response } = credential;

    return {
      id: this.arrayBufferToBase64Url(rawId),
      type,
      rawId: this.arrayBufferToBase64Url(rawId),
      response: {
        clientDataJSON: this.arrayBufferToBase64Url(response.clientDataJSON),
        attestationObject: response.attestationObject
          ? this.arrayBufferToBase64Url(response.attestationObject)
          : null,
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

  async signalUnknownCredential(rpId, credentialId) {
    if (PublicKeyCredential.signalUnknownCredential) {
      await PublicKeyCredential.signalUnknownCredential({ rpId, credentialId });
      console.log(
        `Signaled unknown credential for credential (${credentialId})`
      );
    }
  }

  handleAuthenticationResponse(response) {
    const event = new CustomEvent("authentication-success", {
      detail: response,
    });

    document.dispatchEvent(event);

    console.log("Authentication event dispatched");
  }
}
