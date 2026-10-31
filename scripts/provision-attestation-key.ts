/**
 * Makes a new Ed25519 attestation key pair.
 *
 *   npx tsx scripts/provision-attestation-key.ts vora-attest-2026-10
 *
 * Prints (1) the two environment variables to set on the server (the PRIVATE key is shown once and is not stored anywhere by this script) and (2) the SQL that
 * registers the PUBLIC key. To rotate: run it again with a new id, register the new key, then set the new variables; the old key is retired by the SQL printed
 * below, and everything it signed still verifies. If a key is ever exposed, mark it compromised (see DEPLOYMENT.md) and rotate at once.
 */
import { generateKeyPairSync } from 'node:crypto'

const id = process.argv[2]
if (!id || !/^[A-Za-z0-9._-]{3,64}$/.test(id)) { console.error('Usage: provision-attestation-key.ts <key-id>   (3-64 characters: letters, digits . _ -)'); process.exit(1) }
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
console.log(`# 1. Server environment (Vercel: mark the private key "Sensitive"; never commit it)
VORA_ATTESTATION_KEY_ID=${id}
VORA_ATTESTATION_PRIVATE_KEY=${priv}

-- 2. Register the public key (Supabase SQL editor). Retire the previous active key in the same transaction, since only one key is active at a time.
begin;
update attestation_keys set status = 'retired', retired_at = now() where status = 'active';
insert into attestation_keys (key_id, public_key, status, note) values ('${id}', '${pub}', 'active', 'provisioned ${new Date().toISOString().slice(0, 10)}');
commit;`)
