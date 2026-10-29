# SEO audit and release checklist

## Implemented and locally inspectable

- [x] Server-rendered title and meta description on each core/public service/article page
- [x] HTTPS canonical URL generation from `PUBLIC_BASE_URL` (production must configure HTTPS)
- [x] `hreflang` URL pairs for English/Indonesian paths (translation completeness **not** verified)
- [x] `robots.txt` and dynamic `sitemap.xml` for public core URLs, services, published articles and published custom pages
- [x] No-index for admin and QR verification endpoints, plus `X-Robots-Tag`
- [x] Organization JSON-LD: only admin-supplied telephone/address/email plus VORA name and legal input
- [x] OG and Twitter meta tags, semantic `h1` headings for main pages, service detail paths
- [x] Editorial article slug and SEO title/description fields, published/draft distinction
- [x] Image alt text for selected UI assets and mandatory alt on new media uploads
- [x] Redirect manager for existing page paths (301 with relative-path validation)

## Pending manual or engineering work

- [ ] Verify canonical origin and user locale strategy after obtaining official production domain
- [ ] Complete genuine ID translation for all static service/solution/supporting copy and page SEO descriptions
- [ ] Add Service, BreadcrumbList, Article/BlogPosting and conditional FAQPage schema in public markup
- [ ] Populate OG image previews per page and article; support image metadata/social editor
- [ ] Implement full multilingual CMS field pairing and per-locale sitemap/hreflang validation
- [ ] Add sitemap lastmod, SEO editor warnings and slug-change auto-redirects
- [ ] Verify redirects, image optimization, and structured data using production URL and Google's public testing tools
- [ ] Connect Search Console, GA4 and consent-aware analytics only after consent and production configuration
- [ ] Run real Lighthouse Web Vitals audits and address issues; no LCP/CLS/INP scores are claimed here

Do not index privacy/terms while placeholder notices remain unapproved. The current implementation sets noindex when the corresponding administrator policy field is blank.
