Your bill of materials tells reviewers what you plan to buy. You need one before you can submit for Design Review.

## Where it goes

Put a file called `bom.csv` in the **root of your repo**, next to your README. Throttle reads it straight from GitHub, so make sure the repo is public and the file is pushed.

## Columns

Four columns, in this order: `part,qty,unit_price,link`

- `part`: what it is, specific enough to order.
- `qty`: how many.
- `unit_price`: price for one, in **USD**, no `$` sign.
- `link`: where you'll buy it.

## Example

```csv
part,qty,unit_price,link
1806 2300kV brushless motor,1,12.99,https://example.com/motor
2S 450mAh LiPo,2,8.50,https://example.com/lipo
5x3 propeller (pack of 4),1,3.20,https://example.com/props
20A ESC,1,14.00,https://example.com/esc
```

Throttle adds up qty × unit price for each row and shows the total on your project page.

## How it relates to your grant

Your grant comes from your **approved design hours × your tier rate**, not from the BOM total. See [Tier rates](/docs/tiers).

The BOM is there so reviewers can see the plan makes sense: the parts match the design, and nothing on the list is out of scope. If your parts cost more than your grant, you pay the difference yourself. If they cost less, spend the rest on spares. You'll break props.

## Tips

- Add spares now. Props, a second battery, extra servos.
- Include tools only if you actually need to buy them for this build.
- Prices change. Update the file if you switch parts before submitting.
