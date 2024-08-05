# @acryps/glyph
Convert your icons into a glyph font while building.

Run this in your build:
```
npx glyph <icons directory> <output directory> <optional base path>
```

Make sure that the icons are named lowercase, using letters, numbers and dashes (`-`).
The optional base path is used as a prefix for the location of the font files

Will generate
- Glyph Fonts in WOFF, WOFF2, TTF, SVG and EOT
- @acryps/style mapping and font declaration (include in your root stylesheet using `icons()`)
- Direct insert functions to generate DOM elements (just use `<name of icon>Icon()` in your JSX)
