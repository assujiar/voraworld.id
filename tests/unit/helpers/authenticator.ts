import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto'
import { isoBase64URL, isoCBOR, isoUint8Array } from '@simplewebauthn/server/helpers'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'

/** A software passkey, for tests: it answers the way a platform authenticator does, so the verification code is exercised for real. */
export class SoftPasskey {
  readonly credentialId = isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(32)))
  private pair: { privateKey: KeyObject; publicKey: KeyObject } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  counter = 0
  constructor(private rpId: string, private origin: string) {}

  private authData(flags: number, withKey: boolean): Uint8Array {
    const counter = new Uint8Array(4); new DataView(counter.buffer).setUint32(0, this.counter)
    const parts = [createHash('sha256').update(this.rpId).digest(), Uint8Array.of(flags), counter]
    if (withKey) {
      const jwk = this.pair.publicKey.export({ format: 'jwk' })
      const cose = isoCBOR.encode(new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, isoBase64URL.toBuffer(jwk.x!)], [-3, isoBase64URL.toBuffer(jwk.y!)]]))
      const id = isoBase64URL.toBuffer(this.credentialId)
      const len = new Uint8Array(2); new DataView(len.buffer).setUint16(0, id.length)
      parts.push(new Uint8Array(16), len, id, cose)
    }
    return isoUint8Array.concat(parts)
  }

  register(challenge: string, o: { origin?: string; verified?: boolean } = {}): RegistrationResponseJSON {
    this.counter = 0
    const clientData = JSON.stringify({ type: 'webauthn.create', challenge, origin: o.origin ?? this.origin, crossOrigin: false })
    const attestation = isoCBOR.encode(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', this.authData(o.verified === false ? 0x41 : 0x45, true)]]))
    return { id: this.credentialId, rawId: this.credentialId, type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: isoBase64URL.fromUTF8String(clientData), attestationObject: isoBase64URL.fromBuffer(attestation) } }
  }

  /** `verified: false` is an authenticator that only checked the user was present (touch), not who they are. */
  assert(challenge: string, o: { origin?: string; rpId?: string; verified?: boolean; counter?: number } = {}): AuthenticationResponseJSON {
    this.counter = o.counter ?? this.counter + 1
    const clientData = isoUint8Array.fromUTF8String(JSON.stringify({ type: 'webauthn.get', challenge, origin: o.origin ?? this.origin, crossOrigin: false }))
    const saved = this.rpId; if (o.rpId) this.rpId = o.rpId
    const authData = this.authData(o.verified === false ? 0x01 : 0x05, false)
    this.rpId = saved
    const signature = sign('sha256', isoUint8Array.concat([authData, createHash('sha256').update(clientData).digest()]), this.pair.privateKey)
    return { id: this.credentialId, rawId: this.credentialId, type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: isoBase64URL.fromBuffer(clientData), authenticatorData: isoBase64URL.fromBuffer(authData), signature: isoBase64URL.fromBuffer(signature) } }
  }
}
