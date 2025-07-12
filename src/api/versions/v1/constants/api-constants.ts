export const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export const BAN_MESSAGE_TEMPLATE = "You are {type} banned due to {reason}";

export const BODY_SIZE_LIMIT_EXCEEDED_MESSAGE =
  "Request body size limit exceeded";
export const INVALID_TOKEN_MESSAGE = "Invalid token";
export const NO_SESSION_KEY_MESSAGE = "No session found for this user";
export const NO_TOKEN_PROVIDED_MESSAGE = "No token provided";
export const MISSING_MANAGEMENT_ROLE_MESSAGE = "Missing management role";
export const MISSING_VERSION_MESSAGE =
  "Missing version information on the server";
export const EMPTY_NOTIFICATION_MESSAGE =
  "Notification message cannot be empty";
export const CONFIGURATION_NOT_FOUND_MESSAGE = "Configuration not found";
export const NO_MATCH_FOUND_MESSAGE = "User is not hosting a match";
export const BAD_REQUEST_MESSAGE = "Invalid request body";
export const USER_NOT_FOUND_MESSAGE = "User not found";
export const AUTHENTICATION_OPTIONS_NOT_FOUND_MESSAGE =
  "Authentication options not found";
export const AUTHENTICATION_OPTIONS_EXPIRED_MESSAGE =
  "Authentication options expired";
export const CREDENTIAL_NOT_FOUND_MESSAGE = "Credential not found";
export const AUTHENTICATION_FAILED_MESSAGE = "Authentication failed";
export const NO_SESSION_FOUND_MESSAGE = "User session not found";
export const MATCH_CREATION_FAILED_MESSAGE = "Match creation failed";
export const MATCH_DELETION_FAILED_MESSAGE = "Match deletion failed";
export const DISPLAY_NAME_TAKEN_MESSAGE = "Display name is already taken";
export const REGISTRATION_OPTIONS_NOT_FOUND_MESSAGE =
  "Registration options not found";
export const REGISTRATION_OPTIONS_EXPIRED_MESSAGE =
  "Registration options expired";
export const REGISTRATION_VERIFICATION_FAILED_MESSAGE =
  "Registration verification failed";
export const CREDENTIAL_USER_ADD_FAILED_MESSAGE =
  "Failed to add credential and user";
export const INTERNAL_SERVER_ERROR_MESSAGE = "Internal server error";
