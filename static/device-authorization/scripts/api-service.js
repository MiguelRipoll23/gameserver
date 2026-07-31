export class APIService {
  static API_PATH = "/api";
  static API_VERSION = "/v1";
  static AUTHENTICATION_ENDPOINT = `/authentication`;
  static AUTHENTICATION_OPTIONS_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/options`;
  static VERIFY_AUTHENTICATION_RESPONSE_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/response`;
  static DEVICE_AUTHORIZATION_COMPLETE_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/device-authorization/complete`;

  constructor() {
    this.baseURL = APIService.getBaseURL();
  }

  static getBaseURL() {
    const { protocol, host } = self.location;
    return `${protocol}//${host}${this.API_PATH}${this.API_VERSION}`;
  }

  static async throwAPIError(response) {
    const errorResponse = await response.json();
    const error = new Error(errorResponse.message);
    error.code = errorResponse.code;
    throw error;
  }

  async getAuthenticationOptions(authenticationOptionsRequest) {
    const response = await fetch(
      this.baseURL + APIService.AUTHENTICATION_OPTIONS_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authenticationOptionsRequest),
      }
    );

    if (response.ok === false) {
      await APIService.throwAPIError(response);
    }

    return response.json();
  }

  async verifyAuthenticationResponse(verifyAuthenticationRequest) {
    const response = await fetch(
      this.baseURL + APIService.VERIFY_AUTHENTICATION_RESPONSE_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyAuthenticationRequest),
      }
    );

    if (response.ok === false) {
      await APIService.throwAPIError(response);
    }

    return response.json();
  }

  async completeDeviceAuthorization(deviceAuthorizationRequest) {
    const response = await fetch(
      this.baseURL + APIService.DEVICE_AUTHORIZATION_COMPLETE_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deviceAuthorizationRequest),
      }
    );

    if (response.ok === false) {
      await APIService.throwAPIError(response);
    }
  }
}
