# Project skills

Skills that Claude Code loads when it works in this repository.

## Copied from Anthropic (Apache License 2.0, unchanged)

| Skill | Source | Commit |
|---|---|---|
| `frontend-design` | https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design | a7ba5b9 |
| `brand-review`, `content-creation`, `draft-content` | https://github.com/anthropics/knowledge-work-plugins/tree/main/marketing/skills | 2574e29 |

The licenses are kept next to them (`LICENSE-claude-plugins-official.txt`, `LICENSE-knowledge-work-plugins.txt`, and the one inside `frontend-design/`). The three marketing skills link to a `CONNECTORS.md` of their plugin that is not copied here; it only explains tool placeholders and nothing in this repository uses it.

## Written for VORA

`vora-copywriting` is not from anyone else: it holds the rules this site's copy already follows (see the header of `src/content/about.ts`), plus a list of the tells of machine-written text, in English and Bahasa Indonesia. Use it for any text that visitors read, and run `brand-review` after it.
