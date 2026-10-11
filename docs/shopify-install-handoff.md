# Shopify installation handoff — 2026-10-11

## Follow-up: actual customer Arcade personalization

The user subsequently required real Arcade generation in Shopify, replacing the initial visual-only scope. The fake printed text overlay is removed. Explicit Generate with Arcade persists the exact input/request UUID before POST; owned-session GET polling restores the request after reload. Unknown starts never auto-retry. Missing/false customer capability disables starts. Simulation with text requires the succeeded matching derivative.

The image now shows an explicit generation indicator with the current phase and elapsed time, saved across reload. Product rendering is described as taking several minutes, without a fake percentage or completion estimate. Check Arcade status reads the existing job only. When finished, the actual provider image replaces both the main preview and selected thumbnail; the caption names the personalized text. Square contain sizing displays the full product. Thumbnail cards support keyboard selection. Retry connection restores widget and Shopify cart bridge after initial configuration failure. Authoritative invalid-input rejection permits correction; busy or ambiguous requests preserve their original key.

Final widget readback SHA-256: `11d741e67a7bf9ae7aa9ff316965c7d8d8d1d17005bb8879c57c9cb57d89aab3`. Bridge SHA-256: `4b4c1f6ab7995fd2af07493388d039a86aa37c2c0c250d0e75bde2281c62b3d7`. Fresh local fixture suite **128/128 passed**, including **34 widget + 6 cart mapping tests**, with no live provider calls. JavaScript syntax passed.

Actual customer runs:

- The installer's one coordinated Shopify run, Yosemite 2026, personalization `cc69f854-e6f3-4322-b082-f96572189337`, completed as provider product `b171bef1-4167-4d7d-ade7-28ebe83209c6` after parent reconciled the original timed-out start using its exact request. Parent reviewed the actual full image in `docs/qa/arcade-customer-product-full.png` for integrated lettering. No second Generate/Resume was clicked by this installer.
- The user's own Yosemite 2025 run, personalization `9d08de0d-06a5-44e4-9174-7bb4fb308b44`, started at 21:25:10.829Z and completed normally after approximately three minutes, product `b5245f40-968a-421e-adc3-5ff9e88aa158`. Refinement took approximately 72 seconds, followed by provider product rendering. The parent increased the provider request timeout from 60 to 180 seconds.
- Actual Shopify browser reload restored Yosemite 2025 with GET only: final image and selected thumbnail both use the GCS image ending `b716eba6-6b5d-46ea-8922-eb9e8da23ff8.png`, naturalWidth 1024, generation indicator hidden and aria-busy false. The source design image differs. Screenshot: `docs/qa/shopify-final-image-and-thumbnail.png`. Parent inspected `docs/qa/arcade-yosemite-2025-full.png`: integrated lettering is readable at 1024 pixels but small at widget width.

No generated-personalization simulation was performed by this installer after the user started their own 2025 request. Earlier dashboard simulation evidence below belongs to the **historical visual-only flow** and is not proof of the new generated checkout event. Active-generation image progress and final replacement are regression-tested with fixtures; no additional live generation was started just to capture a spinner.

Parent owns customer API, gateway, provider runtime and dashboard. A subsequent actual Shopify attempt with text Praha was rejected by the hardcoded two-per-session limit, so no provider job started and no new image was expected. Parent loaded the session-cap fix after the other live studio job completed; runtime now follows the configured global maximum of twenty (existing shared budget). Public customer capability is enabled. No automatic Praha retry was issued. The actual storefront was reloaded read-only and preserved text Praha, its same saved request, original image and enabled Recover Arcade request action. Screenshot: `docs/qa/shopify-praha-ready-retry.png`. The pending manual action was left to the user; no new provider job was created by this installer.

The widget now persists authoritative limit/busy admission rejection and explicitly says Generation did not start, including after reload. Retry Arcade request sends the same saved input/UUID only on user action. Before an owned job ID arrives the preview says Submitting your request, not Creating. Already-saved rejected requests from the earlier asset lack the stored error; their explicit recovery still preserves the original key. No backend file or runtime was changed by this installer.

## Follow-up: durable personal designs and unambiguous preview progress

The latest widget retains the current request independently of completed-history selection. New attempts, source selection and campaign refresh do not erase previous completed designs or hide the current request. A prominent request banner stays visible while the visitor views an earlier design; View current request returns to the actual latest input and source. Explicit submission brings the preview into view. Its generation indicator remains through provider completion until the final image really loads (`complete` and nonzero naturalWidth); simulation stays disabled until that preview is loaded. No fabricated percent or completion estimate is shown.

Owned history loads from the parent's read-only public route `GET /api/growth/customer-personalizations?sessionId=<visitor UUID>&campaignId=main`. The server filters this exact visitor/campaign and excludes operator rows. History clicks confirm the selected result through its owned GET; they never start or resume provider work. Browser history and explicit selection are also retained locally across reload. These are anonymous visitor-session records, not shared customer-account or cross-device history.

GET responses are bound to their captured record ID, input and session. Rapid history clicks cannot select an older late response. A completed history entry cannot regress to an older running snapshot; product-stage records cannot regress to refinement. A completed design whose creator source has been archived remains viewable, with simulation disabled.

Actual final Shopify browser proof, from the original visitor session `ec4cc40e-c84d-4511-948a-82d2b56dfccb`:

- The real history API restored both **Yosemite 2025** and **Yosemite 2026**, which had been lost from the single latest local record.
- Clicking each history card loaded its own real Arcade image. Selecting 2026 loaded the GCS image ending `c6f6368f-a4b4-4367-9179-116277e3fc36.png`, naturalWidth 1024, matching caption, selected history card and source thumbnail.
- Reload retained selected **Yosemite 2026**, both history entries, and separate **View current request · Praha**. No generation/continuation was clicked. Console error/warning capture was empty.
- Screenshots: `docs/qa/shopify-history-selected-reload.png`, `docs/qa/shopify-personalization-history.png`.
- The user's later actual **Prague** request belongs to a different visitor session `ef3c5e83-e703-44a3-bfdf-7e8f665cce16`; parent confirmed it succeeded as product `11a51610-b943-48d2-85bf-33f58c5f6a19`. It correctly does not appear in the original visitor's history. No session data or cookies were transplanted to manufacture a browser proof.

Final full fixture verification: **128 passed, 0 failed**, with no live provider calls. It includes delayed final-image loading, pending reload, actual campaign/source changes, prior-design viewing while a new request is running, admission denial retaining completed designs, two history-click races, mismatching poll identity, archived-source viewing, restored selected history after reload and late-history state regression. No extra generation was started to capture the new spinner; active progress is fixture-verified and actual completed/history rendering is browser-verified.

## Visitor access

Creator URL: **https://arcade-creator.myshopify.com/products/weekend-power-set?creator=alex**.

Visitors enter the existing storefront password, then reopen the complete creator URL if the password redirect drops its query. The owner can retrieve the password in **Shopify admin → Online Store → Preferences → Password protection**. No administrator or customer login is required. The password is absent from this file and inter-chat messages.

Add Weekend to the Shopify cart, open **Open creator collection ↗**, select **Outdoor Heavyweight Pillow Cover**, enter a short text, click **Generate with Arcade**, wait for the final image and use **Simulate this purchase →**. Replace Weekend with Adventure to compare $60 / $0. The theme footer links both products.

The simulation does not use Shopify's native **Check out** / **Buy it now** buttons. No payment, order, shipment, manufacture or payout was performed by this installer.

## Verified target and products

- User-confirmed development store: `arcade-creator.myshopify.com`; admin displayed **Grow / Vývojářský obchod**. The separate trial store `v8ju7c-yk.myshopify.com` was not modified.
- Theme: **test-data**, ID **208172876113**, role `live` within this development store.
- Currency: **USD**, saved and read back in authenticated admin.
- Both products were created in authenticated admin, active, available in Online Store only, inventory tracking disabled. Numeric variants were read from actual Shopify storefront product data.

| Product | USD price | Product ID | Variant ID | Campaign mapping |
| --- | ---: | --- | --- | --- |
| Weekend power set | $999.00 | 11235422765393 | 55262142333265 | weekend |
| Adventure power set | $1,299.00 | 11235423879505 | 55262149968209 | adventure |

Handles: `weekend-power-set`, `adventure-power-set`. Existing seeded products were left intact.

## Installed theme files

Shopify CLI authentication was completed by the user. No new Shopify app or Admin API key was created. Uploads named the exact store/theme and used `--nodelete`; original layout backup: `/private/tmp/arcade-shopify-install/theme.liquid.original`.

All five final files were downloaded again and matched their local sources byte for byte:

| Remote theme file | Local source | Final read-back SHA-256 |
| --- | --- | --- |
| snippets/creator-rewards.liquid | integrations/shopify/creator-rewards.liquid | aef63b54622ffbaed11fa36387a8e2668f34e72689070682f1d0a3844e32d3ca |
| assets/creator-rewards-shopify.js | integrations/shopify/creator-rewards-shopify.js | 4b4c1f6ab7995fd2af07493388d039a86aa37c2c0c250d0e75bde2281c62b3d7 |
| assets/creator-rewards-widget.js | prototype/rewards.js | 11d741e67a7bf9ae7aa9ff316965c7d8d8d1d17005bb8879c57c9cb57d89aab3 |
| assets/creator-rewards-coastal.svg | backend/assets/coastal-pillow.svg, copied without edits | 7bf4bf9ce58c23e825fe9b68fee081dbc5da473d9e3deef321a32d76bf64b698 |
| layout/theme.liquid | temporary installation staging | 75bcfa026fc59378990a737c31edbd274cb216d1b8e115707ce169df653dfd66 |

Layout contains exactly one `{% render 'creator-rewards' %}` before `</body>`. Snippet contains actual variants, public gateway and product links. A scoped display rule keeps the shadow DOM host visible despite the theme's `div:empty { display:none }` rule.

The widget script and illustrative Coastal SVG load from Shopify CDN. The parent-approved narrow `prototype/rewards.js` override applies only to `coastal-pillow` when `data-illustrative-image-url` is supplied. It avoids the free ngrok image interstitial, preserves the actual Arcade image URL and existing URL protocol validation. Standalone widgets without the attribute retain existing behavior.

## Public gateway coordination

Public gateway: **https://luann-swampiest-georgianna.ngrok-free.dev**.

Parent confirmed campaign `main` shopUrl and gateway allowlist both use **https://arcade-creator.myshopify.com**. Parent owns gateway, backend and dashboard; this installer did not change them. Parent separately verified public routes/preflight and rejection of private routes/foreign origins; see `shopify-public-handoff.md`.

## Historical visual-only browser and dashboard results

Checks used the actual password-unlocked storefront in the independent Codex browser, with its Shopify Ajax cart. Initial Weekend addition used the theme's real **Add to cart** button; later cart replacements used Shopify's page-defined cart tools.

| Check | Observed result |
| --- | --- |
| Weekend alone, quantity 1 | Fan **$60.00**, merchant subsidy **$80.00**, reward model cost **$140.00** |
| Adventure alone, quantity 1 | Fan **$0.00**, subsidy **$140.00**, Fully covered |
| Empty cart after eligible cart | Contribution/subsidy cleared to `—`; simulation disabled |
| Adventure plus unmapped seeded Liquid snowboard | Explicit unmapped-product explanation; amounts cleared; simulation disabled |
| Repeated unchanged polls | Parent dashboard found exactly one Weekend basket update in the stable interval and one Adventure update; local fingerprint tests passed |
| Personalization | **Yosemite 2026**, 13 / 32, visible overlay, marked local visual preview |
| Simulation | **Simulation recorded ✓**, explicit no-payment/no-order success message |
| Real Arcade reward | Outdoor Heavyweight Pillow Cover; original GCS image loaded, naturalWidth 1024; **Arcade-generated base design** provenance |
| Coastal after CDN fix | Shopify CDN SVG loaded, naturalWidth 800; **Illustrative base design** provenance; switching back restored actual Arcade image with no stale error |
| Console | Final visitor tab captured **no error or warning entries**; API actions succeeded without visible CORS errors |
| Mobile viewport | Actual DOM **390 × 844**, document width 390; image, text, $60 and simulation control visible; override reset afterward |

Parent's read-only dashboard confirmation of the original browser simulation:

- Session `5e3e1617-4bf8-46be-a8f4-eb6acbca8524`; actual origin `https://arcade-creator.myshopify.com`, `shopConnected=true`.
- Visit `2026-10-11T20:51:11.718Z`.
- Weekend basket `2026-10-11T20:52:39.663Z`, copay 6000 / subsidy 8000 cents.
- `checkout_simulated`: **74ed5417-a5f6-454a-bcb5-e0f566b54883**, `2026-10-11T20:53:11.509Z`.
- Reward **60ef47fd-30c8-40ed-b2cd-ac07fdde763a**, actual Arcade provider product **02f5575a-78c3-41b6-9df5-b6517adc1d71**.
- Text **Yosemite 2026**, mode `visual_preview_only`; `orderPlaced=false`, `paymentOccurred=false`, `payoutsOccurred=false`.
- Exactly one visit, one reward selection and one simulation in that session. Adventure basket `2026-10-11T20:54:05.113Z`, copay 0 / subsidy 14000 cents.

Final fresh document after asset fixes was restored to Weekend quantity 1, actual Arcade reward, visual text and $60, with no stale error. It did not create another simulation.

Screenshots under `docs/qa/`: `shopify-weekend-personalization.png` (original simulation), `shopify-adventure-zero.png`, `shopify-weekend-final.png`, `shopify-coastal-cdn.png`, `shopify-mobile-390.png`. `shopify-unsupported-cleared.png` is earlier negative-cart evidence before the image fix.

Historical cart verification: **6 passed, 0 failed**. Current full results are recorded in the follow-up above. The bridge subsequently changed only to recover mounting after explicit configuration retry.

## Remaining limits and dependencies

- Gateway uptime depends on parent's running local services/ngrok tunnel. After final Shopify QA, parent announced short backend restarts for separately owned personalization work. Verification of availability after those restarts belongs to parent.
- Mobile check was a browser viewport, **not a physical phone**. A completely fresh private context was not tested; visitor tab had the storefront password cookie. Storefront entry itself was verified to request only its password.
- Gateway outage/recovery was not exercised by stopping parent's service.
- Historical evidence in the section above covers visual-only personalization. Actual customer provider results and remaining generated simulation verification are separated in the follow-up.

## Files changed by this installer

- `integrations/shopify/creator-rewards.liquid`: actual gateway/variants, product links, theme visibility fix, widget/SVG assets.
- `prototype/rewards.js`: illustrative CDN fix and subsequently real customer-generation UI/state handling.
- `integrations/shopify/creator-rewards-widget.test.mjs`: provider workflow fixture tests.
- `docs/shopify-demo.md`: current status and asset instructions.
- `docs/shopify-install-handoff.md`: this handoff.
- `docs/qa/shopify-*.png`: screenshots listed above.
- `integrations/shopify/creator-rewards-shopify.js`: mounts after explicit initial-configuration recovery; cart validation unchanged.
- Remote theme: five files listed above. Backend was not changed.

No production store, native payment, order, manufacture, payout, new app, API key or authentication setting was changed. Automatic approval review rejected transmitting the storefront password to another chat; it was not sent, and access is handed over through the owner's Shopify Preferences page.
