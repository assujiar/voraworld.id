import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { fromB64url, b64url } from '../crypto'
import { publicBaseUrl } from '../env'

/**
 * Passkeys (WebAuthn) as the signer's own authentication. The relying party is this site: the RP ID is its host and the only accepted origin is its address, both from
 * the server's configuration (never from the request), so an assertion made for another site, or for a look-alike, is refused. User verification (a PIN, a fingerprint,
 * a face) is required, so that holding the device is not enough. The private key never leaves the signer's device.
 */
export function relyingParty(base = publicBaseUrl()): { id: string; origin: string; name: string } {
  const u = new URL(base)
  return { id: u.hostname, origin: u.origin, name: 'VORA' }
}

export interface StoredCredential { credentialId: string; publicKey: string; counter: number; transports: string[] | null }

export async function registrationOptions(o: { userId: number; email: string; displayName: string; existing: StoredCredential[] }) {
  const rp = relyingParty()
  return generateRegistrationOptions({
    rpName: rp.name, rpID: rp.id, userName: o.email, userDisplayName: o.displayName, userID: new TextEncoder().encode(`vora-user-${o.userId}`), attestationType: 'none',
    excludeCredentials: o.existing.map((c) => ({ id: c.credentialId, transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, timeout: 120_000,
  })
}

export async function verifyRegistration(response: RegistrationResponseJSON, expectedChallenge: string, rp = relyingParty()) {
  const out = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: rp.origin, expectedRPID: rp.id, requireUserVerification: true })
  if (!out.verified || !out.registrationInfo) throw new Error('The passkey could not be verified')
  const { credential, credentialDeviceType, credentialBackedUp } = out.registrationInfo
  return { credentialId: credential.id, publicKey: b64url(credential.publicKey), counter: credential.counter, transports: (credential.transports ?? null) as string[] | null, deviceType: credentialDeviceType, backedUp: credentialBackedUp }
}

/** The request options for a signing: the challenge IS the payload's SHA-256, and only the signer's own, unrevoked passkeys may answer. */
export async function signingRequestOptions(challengeB64: string, credentials: StoredCredential[], rp = relyingParty()): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: rp.id, challenge: fromB64url(challengeB64), userVerification: 'required', timeout: 120_000,
    allowCredentials: credentials.map((c) => ({ id: c.credentialId, transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
  })
}

/** The challenge a client answered, read from its clientDataJSON (only to find which stored challenge to consume: it is verified against the stored one right after). */
export function challengeOfResponse(response: AuthenticationResponseJSON | RegistrationResponseJSON): string {
  try { return String(JSON.parse(new TextDecoder().decode(fromB64url(response.response.clientDataJSON))).challenge ?? '') } catch { return '' }
}

export async function verifyAssertion(response: AuthenticationResponseJSON, expectedChallenge: string, credential: StoredCredential, rp = relyingParty()) {
  const out = await verifyAuthenticationResponse({
    response, expectedChallenge, expectedOrigin: rp.origin, expectedRPID: rp.id, requireUserVerification: true,
    credential: { id: credential.credentialId, publicKey: fromB64url(credential.publicKey) as Uint8Array<ArrayBuffer>, counter: credential.counter, transports: (credential.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined },
  })
  if (!out.verified) throw new Error('The authentication could not be verified')
  const i = out.authenticationInfo
  return { newCounter: i.newCounter, userVerified: i.userVerified, deviceType: i.credentialDeviceType, backedUp: i.credentialBackedUp, origin: i.origin, rpId: i.rpID }
}
