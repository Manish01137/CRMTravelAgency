# Package brochures

Travel package brochures — every page 1080 × 1350 px, one brochure page per PDF page.
One template, one data file per trip.

```
brochures/
  brand.js                    window.BRAND   — company details (same for every trip)
  packages/list.js            window.PACKAGE_LIST — slugs shown on index.html / exported by "all"
  packages/<slug>.js          window.PACKAGE — one trip (copy winter-spiti.js)
  assets/brand/               logo.png, qr.png
  assets/<slug>/              cover.jpg, toc.jpg, gallery-1..5.jpg, brief-1..3.jpg, day-1..N.jpg
  template.html               CSS + renderer — open template.html?pkg=<slug>
  index.html                  list of all packages
  export.js                   PDF export (Playwright)
  pdf/                        exported PDFs (not committed)
```

## Setup (once)

```
cd brochures
npm install
```

## Export

```
node export.js winter-spiti           # → pdf/winter-spiti.pdf
node export.js all                    # every slug in packages/list.js
node export.js winter-spiti --pages   # also pdf/winter-spiti/page-01.png … to review each page
```

The export waits for fonts and images, then lists any page whose text still doesn't fit
(and exits with code 2), e.g. `⚠ Day 4: too much text — shorten the points or notes`.

You can also open `index.html` in Chrome, open a brochure and use **Print → Save as PDF**
(Margins: None, Background graphics: on).

## Adding a package

1. Copy `packages/winter-spiti.js` to `packages/<slug>.js` (slug: lowercase letters, digits, hyphens) and edit the data.
2. Put photos in `assets/<slug>/` with the standard names (missing photos show the “ADD PHOTO” placeholder).
3. Add the slug to `packages/list.js`.
4. `node export.js <slug> --pages` and look through the pages.

Text formatting inside any string: `**word**` → blue bold highlight, `__word__` → bold italic (used in notes).
Mark a batch sold out with `full: true`. Batches continue on a new page after 13 rows.

## Automatic fitting

Text never overlaps or runs off a page. When a page has more text than the design allows:

- **Day pages:** points and notes shrink slightly (down to 16.5px). If that isn't enough, the photo gets
  shorter and the title bar and points move up. A very long title shrinks, then goes on two lines.
- **About, brief itinerary, inclusions / exclusions, things to carry, handbook, reviews, costing notes:**
  the text shrinks slightly. Long inclusion / exclusion lists switch to two columns.
- Anything that still can't fit is reported by `export.js`.
