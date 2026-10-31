# VORA Document Trust: verification, stamp, watermark and electronic signing

This describes what was built, what each part does and does **not** claim, how to deploy it, and what was and was not verified. Read section 11 before relying on it.

## 1. Four separate questions

Verification never gives one "authentic". The public page (`/verify/<token>`) reports separate findings, because they are separate facts:

| Question | Where it is answered |
|---|---|
| Is there a record that VORA registered this document? | `document_verification_tokens` (the QR token). |
| Did VORA issue this exact file? | Archived artifact + VORA's Ed25519 issuance attestation, checked on the page against the public key. |
| Did an authorised person sign it? | `signing_events` (non-certified electronic signature, passkey-authenticated, explicit consent). |
| Is the file in my hand the recorded one? | The visitor's browser computes SHA-256 locally and compares (nothing is uploaded). |
| What is its status now? | Read live from the business records (payment, approval, delivery); never printed into an issued file. |

A QR code, a corporate stamp and a watermark are **not** signatures (the page does not repeat this as a disclaimer). The attestation is an **internal application attestation**, not a PSrE-certified electronic seal (segel elektronik), and the signature is **non-certified**.

## 2. Modules (all under `src/server/trust/`, `src/content/`)

| Capability | Code |
|---|---|
| Policy engine (what each kind of document gets) | `src/content/trust-policy.ts` |
| Verification components (one layout for PDF and screen) | `src/content/verification-blocks.ts` (Signature 1 and 2, Footer 3), `trust-mark.ts` (primitives, lockup), `trust-qr.ts`, `glyphs.ts`, `stamp-art.ts` (generated), `helvetica-metrics.ts` (generated) |
| PDF painter, clickable link, page rotation/crop | `src/server/pdf/trust-mark.ts` |
| Third-party PDF marking | `src/server/pdf/seal.ts`, geometry in `src/content/seal-layout.ts`, `placer-geometry.ts` |
| Immutable artifacts + attestation | `trust/artifacts.ts`, `trust/attestation.ts`, `trust/canonical.ts`, `trust/serve.ts` |
| Evidence ledger, revocation, supersession | migration 0029 (`evidence_events`, `trust_append_evidence`, `trust_revoke`), `trust/revocation.ts` |
| Signing ceremony | `trust/signing.ts`, `trust/signing-payload.ts`, `trust/webauthn.ts`, `src/actions/signing.ts`, `/admin/signing/*`, `/admin/signers` |
| Public verification | `trust/verification-view.ts`, `components/verify/*`, `app/(docs)/verify/[token]/*` |
| Evidence export | `/verify/<token>/evidence` (public summary), `/admin/evidence/<kind>/<id>` (administrator) |
| Email verification links | `src/server/mail/verification-links.ts`, `outbox.ts` |

## 3. Documents and their policy

`trustPolicy(kind, documentKind)` is the only place that decides. Every document gets a verification record, the mark and a clickable link.

| Document | Archived (immutable file) | Personal signing in VORA |
|---|---|---|
| Invoice, official receipt, quotation | **No, by decision** (see below): drawn live as before | Optional / conditional, allowed |
| Pre-payment receipt | Yes (unless it needs an e-meterai) | Conditional |
| Delivery note, proof of delivery | Yes | None: issued and verified only |
| General letter, billing letter, certification letter, assignment letter, certificate | Yes | Allowed (non-certified) |
| Statement letter, power of attorney | Yes | Allowed **only after a recorded legal review** |
| Cooperation agreement, logistics service agreement, NDA | Yes | Each party signs for itself; legal review first; parties tracked; "fully executed" only when every required party is fulfilled |
| Third-party PDF (seal) | Yes (original kept unchanged, with its own hash) | Allowed |

**Invoices, receipts and quotations are not archived.** Their body shows a status that changes (an invoice's payment status, a receipt's invoice status, a quotation's approval state and open upload link). Freezing them would either print a stale status or remove information from the document, and the brief for this work was to keep their information as it was. They still get the mark, the link, the verification record and a live status on the page; the page says that no file fingerprint is recorded for them. To archive them, set `archive: 'immutable'` in `trust-policy.ts` and accept that their PDF then states the status as at issuance (see KNOWN_LIMITATIONS).

Documents created **before** migration 0029 (`settings.trust_enabled_at`) are never archived or attested afterwards: they show "issued before the verification system" and nothing more.

## 4. The three verification components

Chosen centrally by `trustPolicy(...).signature` and `.footer` (`content/trust-policy.ts`); never both Signature Type 2 and Footer Type 3 on one document.

| Component | Used for | Shows |
|---|---|---|
| **Signature Type 1** | A regular VORA document when it is signed (the signing ceremony places it) | QR + four rows: Nomor dokumen, Didaftarkan, Nama, Jabatan. No logo, no stamp, no address. |
| **Signature Type 2** | Third-party documents and VORA agreements (cooperation, logistics service, NDA) | The same box, and under a divider, inside it, the complete verification link. Agreements carry no verification footer: Type 2 closes them (corporate registration, VORA as the issuer) and the page numbering stays. |
| **Footer Type 3** | Every other VORA document (invoice, receipt, pre-payment receipt, quotation, letters, statements, certificates, delivery note, proof of delivery) | One framed row of equal-height sections: brand (approved wordmark, tagline, the issuer's address and NPWP from the company settings) \| verification (heading, instruction, the complete address, the document's own notes) \| metadata (number, issued, e-mail, page) \| QR \| the VORA stamp. |

* **One box for Types 1 and 2:** Type 2 is a landscape box 2 : 1 (width : height), 95 x 47.5 mm (`SIGNATURE_DIMENSIONS`). Type 1 is the same box without Type 2's link row (`LINK_ROW`, 26 pt): the same width, corner radius, border, QR code and rows, so it carries no empty space where a link would be. Both are scaled only uniformly (the editor offers 100% and 80%), never stretched, and have **no fill**: the page's watermark shows through them. The four rows sit close together on one fixed pitch (`ROW_PITCH`, 17 pt), centred beside the QR code; a long value (the document number) wraps onto a second line instead of being shrunk or cut.
* **Where the signature goes:** a letter or billing document leaves room for the mark exactly the size of the box, between the issuer's name and the signer's printed name. The renderer records that room in the file (catalog key `VoraSignSlot`: page, left, top, width, height); the signing ceremony reads it (`readSignSlot`) and starts the mark there. The signer can still move it, and a file without such room (a third-party PDF) starts at the usual corner.
* **Links:** VORA red #B43E31, underlined, complete (never truncated: set on one line, else split after `/verify/`, else wrapped inside the token only), real PDF link annotations (the address row, the whole box for signatures, and the QR), and the QR and the link are made from the same address.
* **QR:** vector, dark modules #101720 (Midnight Navy) on white, error correction M, 4-module quiet zone, 22 to 43 mm squares, never overlapped.
* **Typography:** values are Courier (monospaced); in the footer all text is Courier except the stamp's own name, which is part of the approved stamp artwork. Icons are inline line paths (`content/glyphs.ts`), not font glyphs.
* **Artwork:** the `d` of every path of `public/static/assets/vora-a-icon-primary.svg` and `vora-primary.svg`, copied verbatim by `npm run build:trust-assets` into `src/content/stamp-art.ts` (a test fails if they diverge). The footer stamp is as tall as the QR modules and aligned to them; icon, wordmark, rule and name are set close together.
* The corporate marks carry no "not a personal signature" disclaimer, anywhere.
* The browser preview (`components/trust/TrustMark.tsx`) draws the very same layout items as the PDF painter (`server/pdf/trust-mark.ts`).

## 5. The verification page and watermark

* Statuses (bilingual, separated by `|`): ISSUANCE RECORD FOUND, DRAFT / BELUM DITANDATANGANI, REVOKED / DICABUT, SUPERSEDED / DIGANTIKAN, PENDING E-METERAI, AWAITING APPROVAL, ISSUED NOT FULLY EXECUTED, VERIFICATION INCOMPLETE / VERIFIKASI BELUM LENGKAP. An unknown token is a plain "no record found" page (no watermark, no document details).
* The watermark is an inline SVG `<pattern>` (staggered, rotated -24°, seamless) using the same lockup as the stamp, behind the page (opacity .055) and, much fainter (.02), over the information panels. `pointer-events: none`, `aria-hidden`, not selectable; printed as content (not a CSS background); the front layer is hidden in print. **It is a deterrent only and the page says so; it does not stop a screenshot being edited.**
* Also shown: official domain (a constant, never taken from a request), "Viewed on voraworld.id · <server time> · Ref <first 8 characters of the token>", the screenshot notice (ID and EN), copy link / copy reference, file check, evidence summary. No customer, amount, e-mail, IP or secret is on the page (a test checks).
* The site has no dark theme; the page is light-only.

## 6. Email

Every email that carries or concerns a VORA document ends with a clickable verification link, whatever the (admin-editable) template says; the plain-text part keeps the address. Only addresses on the site's own origin under `/verify/` can be added.

## 7. Electronic signing

1. **Profile and authority.** An administrator creates a signer profile for a user with a Supabase Auth account (name and position come from the profile, never from whoever prepares a document). A *different* administrator grants authority per document family, with an optional end date; the sole administrator may grant themselves authority, recorded on the grant. Grants are history: they are ended, never edited or deleted.
2. **Passkey.** The signer registers a WebAuthn passkey in their own session (user verification required; RP ID and origin come from configuration).
3. **Request.** An administrator asks a named, authorised signer to sign a document that VORA issued and archived. The policy must allow it; a high-risk kind needs a recorded legal review; a kind that needs a certificate-backed signature is refused with the instruction to execute it externally.
4. **Ceremony.** Only the named signer, signed in as themselves, can open it. They read the exact archived file, place the signing mark (a real preview, touch and mouse), tick five explicit confirmations and sign. The server builds a canonical payload (file SHA-256 and version, signer, purpose, placement, consent statement hash, nonce, expiry); **the passkey challenge is that payload's SHA-256**. The challenge is used once, before verification; the assertion is verified for this site with user verification; the signed file is made from the archived file, stored, attested and recorded by `trust_complete_signing`, which re-checks in the database, under lock, the request, expiry, authority, passkey, that the file is still the latest and unchanged, and that the document is not revoked.
5. **Result.** A new artifact version (the signed file); the issued version stays as it was.

Not done: drawn/uploaded signature specimens (the signing stamp is typeset text); an administrator cannot use anyone's passkey, but there is no specimen feature to misuse.

## 8. Database (migration 0029, additive)

New tables: `attestation_keys`, `document_artifacts`, `document_attestations`, `evidence_events`, `signer_profiles`, `signer_authorities`, `signer_credentials`, `signing_requests`, `signing_challenges`, `signing_events`, `document_parties`; new columns on `document_verification_tokens` (revocation time, reason, superseded-by); `settings.trust_enabled_at`. All have RLS on and no policy; anon/authenticated have no access. Artifacts, attestations, evidence events and signing events are append-only: triggers refuse update/delete/truncate and the `service_role` has no INSERT/UPDATE/DELETE on them (they are written only by `SECURITY DEFINER` functions with a pinned `search_path`, executable by `service_role` only). Evidence is hash-linked per document (`trust_verify_evidence`).

## 9. Security notes

Server-side authorisation everywhere; the signer's identity, name, position, document status and fingerprint are never taken from the client; challenges are single-use and expire in 5 minutes; a changed document invalidates the request; QR tokens never authorise a download (the archive is private, admin-only routes); `trust_ensure_verification` is the only way a verification record is created for a delivery note; the e-mail link block accepts only same-origin `/verify/` addresses; revoked documents show REVOKED and no live status or holder.

## 10. Tests

* `npm run test:unit` (no database, no Docker): stamp art/geometry/QR decoding on rotated pages, renderers, verification model and page, policy, signing payload and WebAuthn (software passkey), placement geometry, e-mail links, **and the database tests of migration 0029 if a local PostgreSQL is reachable** (`TEST_DATABASE_ADMIN_URL`, default `localhost:5432`; they skip otherwise).
* `npm run test:visual`: Chromium, verification page at ten viewports, watermark, controls above it, print.
* The existing suites (`npm test`, `test:http`, `test:e2e`) need Docker (PostgREST, Supabase Auth). They were **edited** for the new behaviour but **could not be run here**: see KNOWN_LIMITATIONS.

## 11. Legal basis and what it is not

The policy encodes this reading, which a lawyer must confirm before launch (the official sources listed in the brief were **not** fetched or reviewed in this work): an electronic signature has legal effect where the signer is identifiable, controls the signing data, and the document and signature are intact (UU ITE as amended; PP 71/2019); UU 1/2024 art. 17(2a) requires a certificate-backed signature for high-risk electronic transactions, which VORA's non-certified signing does not provide, hence the legal-review gate and the "execute externally" state; the graphic stamp and the internal attestation are not an electronic seal (PP 71/2019); the e-meterai is separate and only the official one counts (UU 10/2020); personal data on the public page is limited to a signer's name and position, a certificate holder's name and title (as before). Which documents are "high-risk" is a legal judgement: `TYPE_OVERRIDES` in `trust-policy.ts` is where it is set.

## 12. Deployment

1. Review and apply `migrations/0029_document_trust.sql` (Supabase SQL editor or `npm run db:migrate`). Nothing is applied automatically.
2. Make the attestation key: `npx tsx scripts/provision-attestation-key.ts vora-attest-2026-11`. Set `VORA_ATTESTATION_KEY_ID` and `VORA_ATTESTATION_PRIVATE_KEY` (Sensitive) on Vercel; run the printed SQL to register the public key. Without the key, documents are archived and fingerprinted but the page says no attestation was available.
3. Rotation: run the script with a new id, register it (the SQL retires the old key), set the new variables. Old attestations keep verifying. Compromise: `update attestation_keys set status='compromised', compromised_at=now() where key_id='…'` then rotate; the page then marks that key's attestations as not to be relied on.
4. `PUBLIC_BASE_URL` must be the final `https://voraworld.id` (it is the passkey RP origin and what is printed in every QR code). Passkeys are tied to the host: changing the domain invalidates them.
5. The private `documents` bucket must allow `application/pdf` (it already does for stamped receipts).
6. After deploy: issue a test letter; open its verification page; check the stamp scans; register a passkey as a signer; have another administrator grant authority; request, sign, and verify the signed version and the evidence export.

## Where everything is in the admin

* **Documents → Verification & Signing** (`/admin/signing`): the signer's own workspace. It shows whether the signed-in person is ready (profile, authority, passkey), what waits for their signature, the issued documents they hold authority for, and what they signed. **Documents you can sign** lists only the documents somebody asked this person to sign. A QR seal that VORA only registered never appears there. **Sign a third party's document** uploads a PDF and signs it: nobody has to ask first. The file is issued as the original (no company seal; `mode = sign`), archived, and the signing page opens to place the one mark, with the signer's name and position. **Sign this document** on a letter's or agreement's own page does the same for VORA's own documents: the request is made for the signer and the signing page opens. The signer is always the session's own profile, which must hold current authority and a passkey. An administrator can still ask somebody else to sign from a document's page.
* **Documents → Signers** (`/admin/signers`): setting up who may sign (profiles, authority, passkeys).
* **A general document's page**: the Verification and signing panel (archive, evidence export, signing, parties).
* **Invoice, quotation, receipt, pre-payment receipt and delivery note pages**: a Verification panel with the public verification address, and the archive and evidence export where the kind is archived.
* **Overview**: a "Waiting for your signature" count for a signer.
* **Issuing a document** (a draft's page): **Issue now with the company's signature** (Signature Type 1 of the company in a letter's room for the signature; an agreement carries the company's closing block as before), or **Issue and ask for a personal signature** (choose who signs; it waits in that person's Documents you can sign, and choosing yourself goes straight to signing). The personal route is checked before issuing: the signer holds authority, and a review is recorded where the kind requires one.
* **Background of the signature block:** transparent by default (the page's watermark shows through) or white, chosen where the block is placed: in the placement step of the signing ceremony and of a QR seal (`background` is part of the signed placement), and when a draft is issued with the company's signature.

