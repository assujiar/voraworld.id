# SEO audit and release checklist

## Implemented and locally inspectable

- [x] Server-rendered `<title>` and meta description on every public page, in both languages (core pages, services, sub-services, articles, CMS pages); the HTML contains the content, not an empty client shell
- [x] Canonical URLs built from `PUBLIC_BASE_URL` (production must use the final https domain)
- [x] `hreflang` alternates for `en` and `id` on every public page (translation completeness of editor-written content is **not** verified)
- [x] `robots.txt` (disallows `/admin`, `/verify`, `/quotation-approval`) and a dynamic `sitemap.xml` with the core pages, every service and sub-service, published articles and published CMS pages in both languages; Privacy and Terms are left out until the owner has published their text
- [x] `noindex` for the admin portal (header `X-Robots-Tag` and `Cache-Control: no-store`), QR verification pages, quotation approval pages and draft previews
- [x] Organization JSON-LD on every public page (name, legal name, URL, and the address only when entered in the admin); Service JSON-LD on service and sub-service pages; `<` is escaped in JSON-LD so content cannot close the script tag
- [x] Open Graph and Twitter card tags; one `<h1>` per main page; semantic headings on service pages
- [x] Article slug, SEO title and SEO description fields; draft versus published; unpublished articles are not reachable and not in the sitemap
- [x] Image alt text is mandatory for new media uploads
- [x] Redirect manager for public paths (301, local paths only) plus built-in permanent redirects for legacy service URLs; `/` redirects to `/en`
- [x] Privacy and Terms pages are `noindex` while the corresponding administrator text is blank

## Pending manual or engineering work

- [ ] Verify the canonical origin and the language strategy once the official production domain exists
- [ ] Review the Indonesian wording of all service, solution and supporting copy with a native speaker, and write per-language SEO descriptions for CMS content
- [ ] Add BreadcrumbList, Article/BlogPosting and (where an FAQ is shown) FAQPage structured data
- [ ] Provide Open Graph preview images per page and article (no `og:image` is emitted today)
- [ ] Add `lastmod` to the sitemap, SEO editor warnings, and automatic redirects when a slug changes
- [ ] Verify redirects, image delivery and structured data on the production URL with Google's public testing tools
- [ ] Connect Search Console, GA4 and consent-aware analytics only after consent handling and production configuration; the GA4/GTM ID fields in Site Settings are stored but nothing is injected into pages
- [ ] Run real Lighthouse / Web Vitals audits on the production domain and address what they find; no LCP, CLS or INP score is claimed here. Pages are rendered per request, so measure with the database in the same region as the functions

Do not index Privacy or Terms while placeholder notices remain unapproved; the implementation already sets `noindex` and omits them from the sitemap when the administrator text is blank.
