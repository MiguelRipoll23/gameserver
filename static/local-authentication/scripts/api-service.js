export class APIService {
  static API_PATH = "/api";
  static API_VERSION = "/v1";
  static REGISTRATION_ENDPOINT = `/registration`;
  static REGISTRATION_OPTIONS_ENDPOINT = `${this.REGISTRATION_ENDPOINT}/options`;
  static VERIFY_REGISTRATION_RESPONSE_ENDPOINT = `${this.REGISTRATION_ENDPOINT}/response`;
  static AUTHENTICATION_ENDPOINT = `/authentication`;
  static AUTHENTICATION_OPTIONS_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/options`;
  static VERIFY_AUTHENTICATION_RESPONSE_ENDPOINT = `${this.AUTHENTICATION_ENDPOINT}/response`;

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

  async getRegistrationOptions(registrationOptionsRequest) {
    const response = await fetch(
      this.baseURL + APIService.REGISTRATION_OPTIONS_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationOptionsRequest),
      }
    );

    if (response.ok === false) {
      await APIService.throwAPIError(response);
    }

    const registrationOptions = await response.json();
    console.log("Registration options", registrationOptions);

    return registrationOptions;
  }

  async verifyRegistration(verifyRegistrationRequest) {
    const response = await fetch(
      this.baseURL + APIService.VERIFY_REGISTRATION_RESPONSE_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyRegistrationRequest),
      }
    );

    if (response.ok === false) {
      await APIService.throwAPIError(response);
    }

    const registrationResponse = await response.json();
    console.log("Registration response", registrationResponse);

    return registrationResponse;
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

    const authenticationOptions = await response.json();
    console.log("Authentication options", authenticationOptions);

    return authenticationOptions;
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

    const authenticationResponse = await response.json();

    console.log("Authentication response", authenticationResponse);

    return authenticationResponse;
  }
}
