export class APIService {
  static API_PATH = "/api";
  static API_VERSION = "/v1";
  static AUTHENTICATION_ENDPOINT = `/authentication`;
  static AUTHENTICATION_OPTIONS_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/options`;
  static VERIFY_AUTHENTICATION_RESPONSE_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/response`;
  static DEVICE_AUTHORIZATION_COMPLETE_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/device-authorization/complete`;
  static REQUEST_TIMEOUT_MS = 10000;

  constructor() {
    this.baseURL = APIService.getBaseURL();
  }

  static getBaseURL() {
    const { protocol, host } = self.location;
    return `${protocol}//${host}${this.API_PATH}${this.API_VERSION}`;
  }

  static async throwAPIError(response) {
    let errorResponse = null;

    try {
      errorResponse = await response.json();
    } catch {
      errorResponse = null;
    }

    const error = new Error(
      errorResponse?.message ?? `Request failed with status ${response.status}`
    );
    error.code = errorResponse?.code ?? "UNKNOWN_ERROR";
    error.status = response.status;
    throw error;
  }

  async postJSON(endpoint, body) {
    const response = await fetch(this.baseURL + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(APIService.REQUEST_TIMEOUT_MS),
    });

    if (response.ok === false) {
      await APIService.throwAPIError(response);
    }

    return response;
  }

  async getAuthenticationOptions(authenticationOptionsRequest) {
    const response = await this.postJSON(
      APIService.AUTHENTICATION_OPTIONS_ENDPOINT,
      authenticationOptionsRequest
    );

    return response.json();
  }

  async verifyAuthenticationResponse(verifyAuthenticationRequest) {
    const response = await this.postJSON(
      APIService.VERIFY_AUTHENTICATION_RESPONSE_ENDPOINT,
      verifyAuthenticationRequest
    );

    return response.json();
  }

  async completeDeviceAuthorization(deviceAuthorizationRequest) {
    await this.postJSON(
      APIService.DEVICE_AUTHORIZATION_COMPLETE_ENDPOINT,
      deviceAuthorizationRequest
    );
  }
}
