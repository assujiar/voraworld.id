# Audit refinement: owner report

Branch `claude/audit-refinement`, based on `origin/main` at `962e37f` (PR 13, POD hotfix). **Nothing is deployed, published, merged, imported or migrated.** No Supabase call was made for this work except the read-only verification done earlier in the session.

## What changed (all local, in the branch)

| Area | Change |
|---|---|
| F01 Services menu | Panel is anchored to the header, `max-width` and `max-height` bounded to the viewport, Escape closes it and returns focus, focus leaving it closes it. |
| F02 Forms | Labels tied to fields with `for`/`id`, fieldsets with legends, `autocomplete`, hints and the error summary linked with `aria-describedby`, focus moves to the error summary, honeypot hidden from assistive technology. Lead requirements are unchanged (the cargo text still fills `message` when the new optional field is empty). |
| F03 Locale and RFQ | The language switch keeps `?mode=` on the quotation form only when the value is on an allow-list built from the real service list; an article switches to its translation, or to the list when no translation exists. |
| F04 Legal and footer | Settings keys `privacy_id`, `terms_id`, `footer_description_en`, `footer_description_id` (no migration). Indonesian shows its own text or an honest notice that the English text applies. Contents list on long legal texts. |
| F05 Empty pages | FAQ: 12 reviewed pairs EN/ID (portal entries win when they exist). Network: how a lane is confirmed. Insights: three starter checklists, filters, archive note. |
| Service pages | Hero and typography are exactly main's (verified: top of the page 0.0% pixel difference at 1440 px on forwarding, air import, LTL, warehousing, services index and home). Below the hero, each mode and group has its own guidance; no price, transit time, free-time, coverage or ownership claims. An earlier version changed global type sizes and the hero; it looked weaker than main and was reverted. |
| Solutions, About, Services | Solutions bands (what the work looks like, what limits the plan, what to send); headlines from the brief. |
| Articles | Contents rail, related reading, language-pair link, archive period shown separately from publication and review dates, JSON-LD with real timestamps, hreflang only where both languages exist. |
| Motion | Hero route drawing plays once to its settled frame, pauses offscreen, follows a reduced-motion change made while the page is open. |
| Admin | Explicit action-key map for processing labels (`ACTIONS` in `busy-labels.ts`), applied to article publish/unpublish/draft and quotation validation. |

## Archive drafts

16 articles, one per quarter Q1 2023 to Q4 2026, each in English and Indonesian (32 entries) in `src/content/archive/`. They are code files, not database rows. `npm run import:archive` is a dry run; `--apply` needs `ARCHIVE_IMPORT_CONFIRM=owner-approved`, inserts only absent `(locale, slug)` pairs as drafts with no publication date and no byline. Archive period and language pairing travel in `tags` (`period:2024-Q3`, `pair:<group>`) so the UI works before any schema change.

**Honest length note.** The brief's guide is roughly 900 to 1,400 English words. These drafts are shorter: see the table in the final message (English 607 to 850 words, Indonesian 528 to 745, tables and the source list included). Each has 5 to 7 sections, a practical block, a limits section and 2 to 3 sources. They are complete drafts that need editorial expansion before publication, not finished 900-word articles.

**Sources.** Eleven of twelve starting sources were read on 2026-10-30 and carry that access date. The WCO HS Convention page returned HTTP 503; it is listed with "access date to be rechecked before publication". The IATA page showed the 68th DGR edition on that date, which may not be the edition for a later shipment. Hypothetical examples are labelled in both languages. No author is named and no VORA history, customer, capacity or result is claimed.

## Needs your authorization (none done)

1. Apply `docs/proposals/0029_archive_metadata.proposal.sql` (additive; checked on a scratch database: idempotent, republish keeps the first `published_at`). Run its pre-check for duplicate `(locale, slug)` first.
2. Run `import:archive -- --apply` (after review) to load the 32 drafts; publishing is a separate step.
3. Approve "VORA Editorial" as a byline, or name reviewers.
4. Enter reviewed Indonesian Privacy and Terms text, and the footer descriptions, in the portal (or approve the built-in footer text).
5. Set `ARCHIVE_DRAFT_PREVIEW=1` on a preview environment only, if you want to read drafts in the site layout without importing.
6. Insert `schema_migrations` rows for 0027 and 0028 on production (left over from the hotfix).
7. Any merge to `main` (that is a production deploy).

## Verification

See the final message for command results and the screenshot manifest summary. Files: `$SCRATCH/matrix/before` (untouched `main`) and `$SCRATCH/matrix/after` (this branch), each with `manifest.csv` (route, locale, requested viewport, measured `window.innerWidth`, shot, commit, file, sha256, overflow, result).

## Not done

- Home and About were not recomposed and now match main except for the About headline. Page-by-page recomposition from the brief was deliberately not pursued after the owner judged the earlier result worse than main.
- Home page recomposition (atlas opening, customer-facing document chain) and the About identity spread were not redesigned; only headlines changed. The clay-tile services section you preferred is untouched.
- Cover image fields exist but the article view does not render them; alt/caption need the migration.
- The email-queued wording ("Email masuk antrean pengiriman.") was not changed: existing tests assert the current English notices, and changing them is a separate, small pass.
- Contrast and keyboard checks were limited to the automated specs below, not a full manual audit.
- The admin processing map covers 7 buttons; the rest still use the text rules.
