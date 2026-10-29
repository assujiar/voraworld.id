# VORA public contact display policy

Owner approved 2026-10-29:

- Public email: **info@voraworld.id**
- Office: **Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810**
- **Do not display telephone or WhatsApp anywhere**, including public pages, admin menus/forms, printed issuer documents, SEO schema, or offline prototype.
- Do not collect contact numbers in Contact/RFQ forms; only collect contact email.
- Legacy SQL `phone` columns are retained for schema/backward compatibility, but new site forms store blanks and frontend does not render existing values.
- When production has pre-existing phone/WhatsApp settings, the server must not expose those fields via public templates or the Organization JSON-LD.

Public navigation must not advertise admin access. Admin is accessed only by manually entering `/admin` or `/admin/login` in the address bar, protected server-side.
