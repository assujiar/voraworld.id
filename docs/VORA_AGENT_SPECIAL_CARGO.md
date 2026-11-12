# VORA Virtual Agent: Cargo Safety, Buttons and Knowledge Base

## Features

- Chat responses use larger fonts on desktop and mobile.
- References to approved first-party pages in model replies are rendered as real clickable buttons. External websites, script URLs, admin routes, or arbitrary model-generated destinations never become clickable.
- Independent server-side risk screening returns a first-party `Request a Quote` action for charcoal, DG, reefer, OOG, breakbulk, heavy lift, restricted goods and special handling. The model cannot suppress this action.
- Risk notes are provided in the system instructions, including UN 1361/4.2 and SP978 for charcoal in 2026, separate from activated carbon UN 1362/SP979, and a requirement for case-by-case carrier confirmation.
- No customer-facing citations; official source URLs remain in private knowledge metadata.

## Database

Run `migrations/0036_agent_logistics_special_cargo.sql` **after** 0031 through 0035. This migration appends newly published bilingual articles with unique seed keys. Existing articles, admin-edited versions and customer records are not overwritten. Run the full setup SQL if starting a fresh database, or apply only missing migrations in numerical order.

## Quality gates before GitHub push

Run from the repository root:

```powershell
npm ci
npx tsc --noEmit -p tsconfig.json --pretty false --incremental false
npx tsc --noEmit -p tsconfig.tests.json --pretty false --incremental false
npm run test:unit -- tests/unit/agent.test.ts tests/unit/agent-freight-safety.test.ts
npm run build
```

**Do not push** if any command fails. The API must also be checked using real Gemini/Supabase credentials in a non-production environment before treating live functionality as verified. Static knowledge is not legal advice or a substitute for live INSW/IMDG/IATA and carrier requirements.

## Agent avatar and UI

- `public/static/assets/vora-agent-profile-v2.png` is the user-provided VORA Agent portrait (transparent PNG). The header, launcher and assistant-message identity all reference this one asset.
- UI icons are consistent 24×24-viewBox SVGs with ~2.15px strokes and adequate touch targets.
- First-party URLs in messages are rendered as clickable styled links (button presentation), with a strict route allowlist. External/model-invented destinations remain plain text.
- `NEXT_PUBLIC_VORA_WEB_ANALYTICS=true` is an optional build-time flag to load the Vercel Analytics script; leave unset when Vercel Web Analytics is not active, avoiding a missing-script console error.

## Validation

Run `scripts/VORA_AGENT_VERIFY.ps1` from Windows PowerShell before committing. The script only reports status and does not push, commit or modify Supabase.
