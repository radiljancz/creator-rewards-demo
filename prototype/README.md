# Functional prototype (current)

Run `PORT=3100 ARCADE_MODE=live npm start` from the workspace. Open `http://127.0.0.1:3100/present` for fan + live dashboard together; `/` for merchant studio and `/shop?creator=alex` for the fan. Node >=24; no build. The base Arcade product is real and stored, personal text is an explicitly labeled local preview, and checkout events are simulations.

`index.html`, `shop.html`, `rewards.js`, and `presentation.html` require the backend. Do not serve the workspace root because it contains private environment files. `creator-rewards-live.html` is an OpenDesign wrapper referencing the running localhost service; it is not an offline export.

Verified: real browser events reach dashboard; saved economics change widget benefit; basket changes co-pay $60 → $0 and preserves model merchant contribution $300. Current screenshots: `presentation-live.png` (functional), `merchant-setup.png` (setup).

# Original offline visualization (historical)

Open `creator-rewards.html` directly in a browser. It is self-contained and works offline. OpenDesign project: `creator-rewards-arcade`, artifact: `creator-rewards.html` (verified version 2).

Four scenes: idea, creator collection, fan shopping, economic outcome. Navigate with the top tabs or left/right arrow keys. `Notes` opens a Czech two-minute presenter script. `Reset` restores all demo choices. Theme swatches change the concept illustration; basket selection changes the financial scenario.

Illustrations are original SVG concepts, not Arcade-generated results. All prices and outcomes are model fixtures. No network API calls, generation, payment, attribution, production or shipping occur. A genuine Arcade asset is the next integration step with the separately developed backend.

Backend contract: `../docs/backend-handoff.md`. Matching scenario IDs: `small`, `large`. Backend money is in integer minor units; this prototype's display fixtures are in whole USD. The fan product's 140 USD model cost is not its standalone retail price.

Verified in Chromium: all four scenes, small/large calculations, simulated completion, reset, presenter notes and no horizontal overflow at 1440px and 390px. OpenDesign rendering exported to `creator-rewards-preview.png`.

For localhost preview:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory prototype
```

Serve only `prototype`, not the workspace root containing private environment files. No build or package installation required.

USD update: fixtures match backend ($460/$520 before campaign, $160/$220 campaign spend, $140 product cost, $60/$0 copay, $300 retained). Existing exported PNG previews predate the USD update.
