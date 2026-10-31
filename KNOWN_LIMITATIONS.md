# Known limitations

The authoritative, current list is in **`RELEASE_READINESS.md`** ("What is NOT verified" and "Known gaps in the product"). It is kept in one place so that it cannot drift.

Business prerequisites that no software release can settle, to be completed by the owner before public launch:

* Confirm the legal status and registered name of PT Satu Arah International.
* Approve the public company details, service descriptions and any coverage statements.
* Replace the empty Privacy and Terms pages with lawyer-reviewed text.
* Review the finance document wording (invoice as payment request, receipt as proof of payment, e-meterai handling) with your tax adviser.
* Decide on operational policies. The portal has a single `admin` role, so the software cannot stop one person from recording and confirming a payment: decide who receives an account, who confirms cleared funds against the bank statement, who reviews the audit log, backup retention, and how leavers are removed.

Test data in this repository is synthetic (`*.invalid`, `*.example`) and must never be presented as real customers or results.

## Document trust: what is not done, not verified, or decided for you

**Not verified in the environment that built it**
* The existing database-backed suites (`npm test`, `npm run test:http`, `npm run test:e2e`) need Docker (PostgREST and Supabase Auth); the build environment had none, so they were **not run**. Their expectations were edited by hand for the new behaviour (verification page words, footer separators, the QR no longer described as a signature, placement confirmation, the seal's mark). Run them before merging; expect to adjust.
* `npm run typecheck` already reported 55 errors in `tests/` on `main` before this work (stale fixtures); the application sources type-check cleanly. The new tests are not among them except one inherited pattern in `tests/seal.test.ts`.
* No `next build` of the signing pages was exercised against a live Supabase; the ceremony's database glue (`trust/signing.ts`, the routes, the pages) has **not** been run end to end. What is tested: the database rules (against a real PostgreSQL), the signing payload, and the WebAuthn verification (against a software passkey), the PDF output, the verification model and page.
* Only Chromium was available: no WebKit/Safari and no real phone. Touch behaviour of the placement editor was written for pointer events and tested as geometry, not on a device. The loupe, tap and drag need a manual pass on iOS Safari and Android Chrome.
* The legal sources named in the brief were not fetched or reviewed here (see `DOCUMENT_TRUST.md` section 11). Which documents are "high-risk" is a legal judgement for your counsel.

**Decisions made for you (reversible)**
* Invoices, official receipts and quotations are **not archived**: their body shows a status that changes and the brief was to keep their information as it was. They have the mark, the link, the verification record and live status, but no recorded file fingerprint. Flip `archive` in `trust-policy.ts` to archive them; their PDF will then state the status as at issuance.
* A receipt or pre-payment receipt that needs an e-meterai is released as the stamped file that was uploaded, with its own stored fingerprint; it is not archived or attested by this system.
* Documents created before migration 0029 are never given an archive or attestation (that would claim evidence that was never kept). To sign one, re-issue it.
* The third-party seal's "VORA signatory" fields are kept as a note of the intended signer; they are not printed and are not proof of identity. A person appears on a document only after signing it.
* If no attestation key is configured, issuance continues without an attestation (recorded as such) rather than failing; set `VORA_ATTESTATION_*` to get attestations.

**Not built**: drawn or uploaded signature specimens; certificate-backed (PSrE) signing or sealing; automatic validation of externally signed PDFs; a supersede screen (the `trust_revoke` function supports it; the screens only void); `DocumentTrustPanel` is on general documents only (invoices etc. have no signing panel yet); evidence export is JSON, not a printable report; no retention/purge policy for evidence (it is kept).

**Verification components: choices and limits to look at on paper**
* Footer Type 3 packs five sections into 71 to 87 pt of height, so its text is small (4.4 to 5.6 pt Courier). It is legible on a laser printout but it is the thing to check first on your own printer. The footer's QR code is 22 to 24 mm; the test decoder reads it at 200 dpi and above (a phone camera does at lower resolutions; the signature QR codes are 33 mm and are read from 100 dpi).
* The heading reads "VORA | DIGITAL DOCUMENT VERIFICATION" (pipe), following your earlier instruction on separators, although the latest layout sketch shows a slash. It is one string per document in the renderers.
* Footer address and NPWP come from the company settings (`settings.address`, `settings.tax_id`), like the letterhead; a very long address is shortened with "..." in the footer only (the letterhead's convention), never the NPWP.
* The agreement's Signature Type 2 block (about 120 x 60 mm) is kept whole: when it does not fit under the signatures it moves to the next page, so a short agreement can end with a page that holds only that block.
* Signature Type 1/2 show Nomor dokumen, Didaftarkan, Nama, Jabatan only. For VORA's own registration of a file (no signer yet) Nama is the company and Jabatan is "Penerbit dokumen"; the purpose of a signature (approved, acknowledged...) and the signing reference are on the verification page and in the evidence, not on the block.
* The stamp's own name (PT SATU ARAH INTERNATIONAL) is set as part of the approved stamp artwork (Helvetica Bold), not in Courier like the rest of the footer.
* No ESLint is configured in the repository, so no lint run was possible.
