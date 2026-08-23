/* ------------------------------------------------------------------ */
/* Passkey (WebAuthn) authentication                                   */
/*                                                                     */
/* Mirrors the hood-ball game client's flow:                            */
/*   1. POST /api/v1/authentication/options  { transactionId }         */
/*   2. navigator.credentials.get({ publicKey })                       */
/*   3. POST /api/v1/authentication/response { transactionId,          */
/*                                             authenticationResponse } */
/*   -> { accessToken, refreshToken, userId, ... }                     */
/* ------------------------------------------------------------------ */

export interface AuthenticationResult {
  accessToken: string
  refreshToken: string
  userId: string
  userDisplayName: string
  userRoles: string[]
}

interface SerializedCredential {
  id: string
  type: string
  rawId: string
  response: {
    clientDataJSON: string
    attestationObject: string | null
    authenticatorData: string | null
    signature: string | null
    userHandle: string | null
  }
}

/* ---------------------------- Encoding ---------------------------- */

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
  const binary = atob(base64 + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/* --------------------------- Serialization ------------------------ */

function serializeCredential(credential: PublicKeyCredential): SerializedCredential {
  const { type, rawId, response } = credential
  const attestation = response as AuthenticatorAttestationResponse
  const assertion = response as AuthenticatorAssertionResponse

  return {
    id: arrayBufferToBase64Url(rawId),
    type,
    rawId: arrayBufferToBase64Url(rawId),
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      attestationObject: attestation.attestationObject ? arrayBufferToBase64Url(attestation.attestationObject) : null,
      authenticatorData: assertion.authenticatorData ? arrayBufferToBase64Url(assertion.authenticatorData) : null,
      signature: assertion.signature ? arrayBufferToBase64Url(assertion.signature) : null,
      userHandle: assertion.userHandle ? arrayBufferToBase64Url(assertion.userHandle) : null,
    },
  }
}

/* --------------------------- API helpers -------------------------- */

interface ApiErrorBody {
  code?: string
  message?: string
}

async function throwApiError(res: Response): Promise<never> {
  let body: ApiErrorBody | null = null
  try {
    body = (await res.json()) as ApiErrorBody
  } catch {
    // Non-JSON error body — fall through to a generic message.
  }
  const message = body?.message || body?.code || `HTTP ${res.status} ${res.statusText}`
  const err = new Error(message) as Error & { code?: string; status?: number }
  err.code = body?.code
  err.status = res.status
  throw err
}

async function postJson<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwApiError(res)
  return (await res.json()) as T
}

/* ------------------------- Authentication ------------------------- */

/**
 * Signs in with a passkey and returns the fresh token pair plus user info.
 * Requires a secure context and WebAuthn support in the browser.
 */
export async function authenticateWithPasskey(baseUrl: string): Promise<AuthenticationResult> {
  if (typeof window === 'undefined' || window.PublicKeyCredential === undefined) {
    throw new Error("Your browser doesn't support passkeys, which are required to sign in. Please try a different browser or device.")
  }
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    throw new Error('A secure context (HTTPS or localhost) is required to use passkeys.')
  }

  const transactionId = crypto.randomUUID()

  const authenticationOptions = await postJson<{
    rpId?: string
    challenge: string
    timeout?: number
    userVerification?: UserVerificationRequirement
  }>(baseUrl, '/api/v1/authentication/options', { transactionId })

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToArrayBuffer(authenticationOptions.challenge),
  }
  if (authenticationOptions.rpId) publicKey.rpId = authenticationOptions.rpId
  if (authenticationOptions.timeout !== undefined) publicKey.timeout = authenticationOptions.timeout
  if (authenticationOptions.userVerification) publicKey.userVerification = authenticationOptions.userVerification

  const credential = await navigator.credentials.get({ publicKey })

  if (credential === null) {
    throw new Error('Passkey request cancelled.')
  }

  const verifyRequest = {
    transactionId,
    authenticationResponse: serializeCredential(credential as PublicKeyCredential),
  }

  try {
    const response = await postJson<Record<string, unknown>>(
      baseUrl,
      '/api/v1/authentication/response',
      verifyRequest,
    )

    const accessToken = response.accessToken
    const refreshToken = response.refreshToken
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('The server did not return an access token.')
    }

    return {
      accessToken,
      refreshToken: typeof refreshToken === 'string' ? refreshToken : '',
      userId: typeof response.userId === 'string' ? response.userId : '',
      userDisplayName: typeof response.userDisplayName === 'string' ? response.userDisplayName : '',
      userRoles: Array.isArray(response.userRoles) ? response.userRoles.filter((r) => typeof r === 'string') : [],
    }
  } catch (error) {
    // Let the authenticator forget credentials that no longer exist server-side.
    if (
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'CREDENTIAL_NOT_FOUND' &&
      authenticationOptions.rpId &&
      'signalUnknownCredential' in PublicKeyCredential
    ) {
      void PublicKeyCredential.signalUnknownCredential({
        rpId: authenticationOptions.rpId,
        credentialId: (credential as PublicKeyCredential).id,
      }).catch(() => undefined)
    }
    throw error
  }
}

/** Rotates the refresh token and returns a new access token pair. */
export async function refreshTokens(baseUrl: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await postJson<Record<string, unknown>>(baseUrl, '/api/v1/authentication/refresh', { refreshToken })
  const accessToken = response.accessToken
  const nextRefreshToken = response.refreshToken
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Token refresh failed: the server did not return a new access token.')
  }
  return {
    accessToken,
    refreshToken: typeof nextRefreshToken === 'string' && nextRefreshToken.length > 0 ? nextRefreshToken : refreshToken,
  }
}
