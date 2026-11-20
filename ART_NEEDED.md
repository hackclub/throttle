# Art needed

Drop finished files into `public/art/` using the slot name below. Placeholders swap automatically, and an SVG with the right name replaces a WebP or PNG stand-in of the same name.

## Still to draw (aviation themed)

| Slot / file | Used on | Size & format | Background | Brief |
|---|---|---|---|---|
| `step-fly.svg` | / How it works, step 3 | 4:3 (480x360), SVG | light blue paper | A small homemade plane just leaving a teen's hands in a hand-launch, with motion lines. |
| `tier-wings-1.svg` | / funding table | 3:1 (240x80), SVG | transparent | Simple pilot wings with one star, muted blue. |
| `tier-wings-2.svg` | / funding table | 3:1, SVG | transparent | Same wings, two stars, a little more detail. |
| `tier-wings-3.svg` | / funding table | 3:1, SVG | transparent | Same wings, three stars and a tiny propeller in the centre, red and gold. |
| `stamp-cleared.svg` | project page once Parts Funded | 1:1 (240x240), SVG | transparent | Slightly crooked red-ink rubber stamp: "CLEARED · PARTS FUNDED". |
| `safety-diagram.svg` | /docs/safety | 16:9 (960x540), SVG | white | Three labelled panels: LiPo in a fireproof bag, hands clear of the prop arc, no-fly icons for people, roads and airports. |
| `bom-example.png` | /docs/bom | 16:9, PNG screenshot | white | Screenshot of a real, nicely filled `bom.csv` from your own build. |
| `og-image.png` | link previews | 1200x630, PNG | sky blue | "Throttle" title with the biplane and banner over the sky gradient. |

## Stand-ins from the Hack Club sticker catalog

These use art from stickers.hackclub.com so the pages aren't empty. They work as they are. Draw an aviation version if you want to swap them, using the same slot name with `.svg`.

| Slot | Currently shows | Aviation version, if you want one |
|---|---|---|
| `step-design` | Journpheus (explorer with goggles and a notebook) | Orpheus at a desk with a wing sketch and a pencil. 4:3 |
| `step-funded` | Mo Parts Mo Problems (raccoon with a pile of parts) | An open parts box with a motor, props and a LiPo, an HCB card in the lid. 4:3 |
| `hangar-empty` | "We Can Build It!" poster | An empty open hangar door with a painted floor marking. 16:9 |
| `signin-orpheus` | Pathfinder Orpheus (explorer hat) | Orpheus in a leather flight cap and goggles, thumbs up. 3:2, transparent |
| `stamp-airborne` | Hack Club "Ship" badge | A round red stamp: "AIRBORNE · SHIPPED" with a tiny biplane. 1:1, transparent |
| `lost` (404 page) | "Where are we?!" (raccoon with a map) | Orpheus lost in a cockpit with a map. 1:1, transparent |

## Done

- `biplane.png`: the plane that flies across the home page and tows the banner.
- Favicon and Apple icon: `src/app/icon.png` and `src/app/apple-icon.png`, cropped from the biplane drawing.
- Nav logo: the favicon plane next to "Throttle" in the workspace header.

The stand-ins come from the Hack Club sticker catalog. Some stickers name individual artists, so credit them in the footer if you keep them.
