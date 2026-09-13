# Watermark Tool website

Standalone Traditional Chinese product landing page. Plain HTML and CSS; no build, JavaScript, dependencies, backend, cookies, or application credentials. Deploy **this directory only** to the existing Nebulab (`nebula-proj`) Vercel Pro team. Do not deploy the parent desktop application as the website.

## Local preview

From the repository root:

```sh
python3 -m http.server 1431 --bind 127.0.0.1 --directory site
```

Visit `http://127.0.0.1:1431`. Check mobile and desktop widths, internal links, FAQ keyboard operation, images, and the contact links. `mailto:` opens the visitor's mail client; there is no mailing-list subscription or data collection form.

## Deployment

Production URL: https://watermark-tool-ivory.vercel.app/

Vercel project: `watermark-tool`, team: `nebula-proj`. Framework preset: Other. No build/install command, output directory `.`. Configuration lives in `vercel.json`. Local account/project linkage under `.vercel/` is ignored by Git. The project uses direct CLI deployment; a GitHub push does not automatically publish this site.

```sh
cd site
vercel link --yes --project watermark-tool --scope nebula-proj
vercel deploy --prod --scope nebula-proj
```

Verify the production alias without Vercel authentication, asset HTTP status, security headers, the custom 404, and that project source/config files are not served. For later releases, use Vercel's production rollback to restore a known-good deployment. The initial launch has no previous deployment to restore; remove the new deployment/project if it must be withdrawn. No existing project, custom domain, billing plan, or repository visibility needs to change.

`vercel link` may automatically create `.env.local` with an OIDC token. This static site does not use it; remove that generated file. `.vercelignore` excludes `.env*` as an additional safeguard. If the production hostname changes, update the canonical/OG URLs in `index.html`, `robots.txt`, and `sitemap.xml` together.

## Content and assets

- `index.html`: product copy, edition status, FAQ and contact. The author email matches the public GitHub profile at publication.
- `styles.css`: responsive styles; system fonts, keyboard focus and reduced-motion support.
- `assets/landscape.svg`, `assets/mark.svg`: original code-authored artwork for this website. FIELD NOTES is a fictional demonstration mark, not a customer endorsement.
- `assets/editor.webp`: real existing App/VideoPlayer/Timeline UI captured with Playwright WebKit at 1440×900 using an original 30-second synthetic mountain video and sample watermark. This is a development UI capture, not a packaged-app compatibility or performance test. The hero is separately labeled as an illustration.
- `assets/social-card.png`: original 1200×630 HTML-rendered social preview.
- Local capture and review evidence: `output/playwright/site-*`, `editor.png`, `field-notes.svg`, `social-card.html`, `slow-road.mp4` (locally ignored; not deployed).

## Before announcing a downloadable/open-source release

The repository was private with no releases or LICENSE at site creation. Community and Pro remain explicitly planned. Settle the source license and public-release scope, publish real assets with verified platform support, and then replace the preparation copy with working release/source links. Do not imply that Pro, a native preview rewrite, paid support, or a particular performance gain is already available. Keep the known preview limitation in the FAQ until its status actually changes.
