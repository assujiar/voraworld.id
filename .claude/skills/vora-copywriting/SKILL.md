---
name: vora-copywriting
description: Write or edit text that visitors, customers or partners will read for VORA (website pages, About, service copy, emails, document wording) in English and Bahasa Indonesia, so that it is plain, specific, credible and does not read as machine-written. Use before writing any public copy and when reviewing a draft for hype, filler and claims that cannot be shown.
---

# VORA copywriting

VORA is a freight and logistics brand of PT Satu Arah International (Jakarta). Its public copy has one job: make a careful buyer trust that the work is planned and the people are accountable. Hype works against that.

## The rules

1. **Say only what can be shown.** No size, age, coverage, client, result, ranking, price or transit time unless it is already stated on the site or the owner has just given it. A claim without a source in this repository or from the owner is cut, not softened. Never invent a testimonial, a number, a client, a founder anecdote or a date.
2. **Concrete nouns and verbs.** "The quote and the final bill did not match" beats "pricing transparency challenges". Name the document, the party, the step.
3. **One idea per sentence, short.** Prefer 8 to 20 words. Read it aloud; if you run out of breath, split it.
4. **A commitment is written only if the product already behaves that way.** "Capabilities and coverage are confirmed per inquiry" is true of the site; "24/7 support" is not.
5. **Plain register.** Write like a competent colleague explaining to a customer. No slogans inside body text. The tagline (Bringing the World Within Reach.) appears as the tagline, not as filler.
6. **Both languages are written, not translated word for word.** Indonesian keeps the industry terms people use (freight forwarding, customs brokerage, HS code, packing list) and the same facts as the English. No claim exists in one language only.
7. **Numbers and names stay exactly as given.** Do not round, merge or "improve" them.

## Tells of machine-written text (cut or rewrite)

- Openers that announce instead of say: "In today's fast-paced world", "Imagine a world where", "At VORA, we believe", "Whether you are X or Y".
- Contrast frames: "not just X, but Y", "more than a X, it is a Y", "it is not about X; it is about Y".
- Rhythm of three: "fast, reliable and secure", used by reflex. Keep a list only when there really are three things.
- Inflated words: seamless, robust, cutting-edge, world-class, best-in-class, state-of-the-art, game-changing, revolutionary, innovative, holistic, end-to-end solution, leverage, unlock, elevate, empower, streamline, delve, tapestry, landscape, journey (as a metaphor), passionate, dedicated to excellence.
- Em dashes and colons used as drama; exclamation marks; rhetorical questions as headings.
- Vague proof: "trusted by many", "years of experience" without the number the owner gave, "industry-leading".
- Closing lines that summarise what was just said, or that promise nothing specific ("We look forward to partnering with you").

Bahasa Indonesia equivalents to cut: "solusi terbaik", "terdepan", "profesional dan terpercaya" (as a bare claim), "berkomitmen memberikan layanan terbaik", "one-stop solution", "mitra strategis Anda", "di era digital saat ini", "tak hanya X, tetapi juga Y" as a reflex, "sinergi", "inovatif", "komprehensif" without a list.

## Process

1. List the facts you may use, each with where it comes from (a file in the repo, or the owner). If a sentence has no fact behind it, it does not go in.
2. Draft short. Then read each sentence and ask: could a competitor print this unchanged? If yes, replace it with something specific to VORA's way of working (scope written down, named responsibilities, checked per inquiry, documents that can be verified).
3. Run the tells list above over both languages.
4. Compare the English and Indonesian facts one by one.
5. Run `brand-review` on the result, and report what was cut and why.

## Where the house rules already live

- `src/content/about.ts` (header comment) and `src/content/footer.ts`: what may be said about the company.
- `src/content/service-extras.ts`, `solution-guides.ts`, `rfq-guidance.ts`: wording that promises no price, time or coverage.
