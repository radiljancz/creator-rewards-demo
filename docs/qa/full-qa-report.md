# Independent demo QA

Current QA conclusion: **All independently exercised creator/history/progress browser matrices passed. Changed backend history/gateway fixtures passed16/16; widget/Shopify fixtures passed38/38. Earlier full-suite baseline passed105/105; parent is running the final combined suite. Original customer reconciliation, image crop, startup retry and rejected-draft findings have resolution evidence below. No uncorrected blocking defect was reproduced in the tested latest UI flows.** Live theme deployment and final combined-suite evidence remain separately attributable to parent/installer. This report retains historical reproductions with resolution labels; later sections supersede earlier rollout notes.

Checked 2026-10-11, initial evidence window 21:15–21:21 UTC. This is a moving development snapshot, not a production or exhaustive security certification. Parent and Shopify installer are concurrently changing the widget, gateway, and creator studio; fixes require targeted retests below.


## Post-change retest (same session)

- Full current suite **102/102 PASS**, 0 failures/skips, exit 0. New catalog/admission tests and widget retry/thumbnail/bridge tests are included.
- Gateway suite **10/10 PASS**, including fixed safe customer error messages. Running gateway restart/readback belongs to parent; this verifies source fixtures.
- **Crop resolved in loaded real browser:** main image295×295 inside preview295×295 on390px viewport; thumbnails125×125. Full1024px provider image and both thumbnails loaded. Screenshot `testing-agent/local-shop-mobile-fixed-loaded.png` was visually inspected and shows the entire pillow. Earlier screenshots with `-fixed` but without `-loaded` deliberately captured loading state and are not final success evidence.
- **Thumbnail picker works:** hidden legacy select, two visible role=radio buttons with aria-checked and roving tabindex; pointer choice and keyboardSpace switch provenance and image. No generation POST or page errors. Arrow navigation also covered by fixtures.
- **Startup retry resolved:** abort first config request, then explicit Retry connection; reads=2, content visible, quote$60.00. No generation. Shopify bridge re-mount after retry is covered by new fixture, not independently exercised against authenticated Shopify here.
- Remaining gates: actual current provider customer result/reconciliation and creator-studio product creation workflow; definitive rejected-draft UX remains a P2 observation. Do not mark provider image quality verified by passing fixtures.


## Creator-studio and provider reconciliation update

- Fresh full fixture suite now **105/105 PASS**, no failures or skips. This includes session-only studio capability and customer correction-vs-uncertain recovery tests.
- Independently ran the creator UI lifecycle in isolated Chromium with every URL intercepted. Verified 3 product category cards, typed Scarf prompt/category persisted before POST, interrupted POST recovered with exactly the same request ID/body, successful new product added and selected, explicit Create another design unlocking input, original retained, collection thumbnails, contain CSS, mobile390 document width390, no page errors. No real provider requests. The fixture required HTTPS test origin because plain `http://studio.test` lacks `crypto.randomUUID`; actual localhost is a secure context.
- Additional fixture scenarios verify `design_limit`, `design_busy`, `personalization_busy`, `provider_unavailable`, `category_unavailable` each disable Generate and show the corresponding reason. Empty prompt disables Generate; valid prompt enables it when available. These checks sent zero generation POSTs.
- Read-only real DB now confirms customer `cc69f854-e6f3-4322-b082-f96572189337` **succeeded**, provider product `b171bef1-4167-4d7d-ade7-28ebe83209c6`. Parent's saved actual product screenshot `arcade-customer-product-full.png` was independently visually inspected: full pillow and legible integrated `Yosemite 2026` appear. This resolves the original customer-result gate; no claim about a newly generated 2025 variant.
- A newer user-requested personalization was running during this check; parent owns it. No reservation release, provider replay, or restart was performed by QA.
- Runtime catalog now exposes all3 families (outdoor pillow/scarf/tea towel) and20 attempt capacity, but session-only admission metadata fix still awaits parent's coordinated restart at the observed point. The new base creation through actual UI/provider is reserved to parent; not yet independently signed off.
- Definitive customer input/source error UX now has passing new tests: correctable rejected drafts are cleared; busy/uncertain requests retain the exact ID/body. Mark prior P2 as resolved in source fixtures, with Shopify deployment/readback owned by installer.
- Creator fixture full-page screenshots exhibit repeated viewport rendering in this headless capture and must not be used as final visual evidence. Mobile DOM width/controls were verified. Final real studio screenshot should be captured after runtime readiness.

## Scope and isolation

- Full Node fixture suite, local merchant studio and fan UI in an isolated ephemeral Chromium browser, read-only SQLite state, public HTTPS gateway GET and quote requests.
- Browser event POSTs were intercepted with fixtures, so these QA visits did not pollute the dashboard. The sole Generate click in QA was fully intercepted with a synthetic 429 response; no backend or Arcade generation request escaped.
- No provider create/refine/resume, manufacturing, checkout, payment, payout, process restart, environment edit, production operation, database mutation, or Shopify admin/cart interaction was performed by this tester.
- Shared Playwright MCP profile was occupied. It was left intact; bundled Playwright launched a separate temporary headless Chrome profile, closed after every check.

## Findings and release gates

### RESOLVED AFTER RECONCILIATION — Original live customer generation was unresolved

Read-only SQLite observation: customer personalization `cc69f854-e6f3-4322-b082-f96572189337`, source `60ef47fd-30c8-40ed-b2cd-ac07fdde763a`, text `Yosemite 2026`, created 21:17:04Z, is `unknown` at product stage with no saved product. This blocks new work through the deliberate global reservation. Both existing base designs are now `succeeded`; old operator personalization is also `succeeded`.

Expected: resolve the exact existing provider request and verify its returned image; do not release the reservation or replay creation by guessing. The parent owns reconciliation. This tester cannot currently sign off live customer personalization or legible text in a generated product. The earlier operator result was reported by the parent as a visual quality failure, despite successful provider state.

### RESOLVED — Product image was genuinely cropped despite object-fit:contain

Reproduced using the local live widget in real Chromium. At desktop 1440px, `.art` is 317×205 while its image is 317×317. At mobile 390px, `.art` is 295×205 and image 295×295. Grid intrinsic sizing enlarges the actual image box; overflow:hidden clips the bottom. Setting object-fit alone does not resolve this.

Expected: constrain the actual image box to the preview area, or use a square/aspect-ratio preview container, preserving the whole product. User-requested thumbnail picker is still a dropdown in this snapshot. Parent/installer are implementing this redesign.

Evidence: `testing-agent/local-shop-desktop.png`, `testing-agent/local-shop-mobile.png`. Retest after widget readiness.

### RESOLVED — First-load network failure did not recover

Intercept only the first `GET /api/growth/public?campaign=main` with a network failure, then permit subsequent reads. After 7 seconds there is exactly one configuration request, hidden widget content, and `Failed to fetch`. The polling guard returns while `config` is absent (`prototype/rewards.js`, configuration interval). Thus reconnecting cannot recover the first load without a page reload.

Expected: a Retry collection action or read-only initialization retry, without initiating generation. Normal polling recovery after a successful initial load is a separate path.

### RESOLVED IN SOURCE FIXTURES — Definitively rejected generation retained an unrecoverable draft UX

Synthetic browser-intercepted 429 leads to a saved record without personalization ID, disabled Generate, and only `Recover Arcade request`. Editing text still leaves Generate disabled. A temporary busy reservation can recover by replaying the exact request later; a permanent validation/source error cannot be corrected from this state.

Expected: distinguish confirmed pre-admission rejections from uncertain POST outcomes. Preserve uncertain requests and idempotency, but allow correcting a request the server confirms it never admitted. Avoid broad clearing on network errors.

### RESOLVED IN FIXTURES — Public customer errors were generic

Initial code discarded all upstream 4xx bodies; shoppers could not distinguish admission caps, busy work, or validation failures. During testing, the parent added a fixed safe error allowlist for customer routes in `backend/public-demo.mjs`. This needs a fresh fixture run / targeted response check before marking verified. Never expose raw provider errors or secrets.

## Verified evidence

### Automated fixtures

Command:

`node --test backend/test/*.test.mjs integrations/shopify/*.test.mjs`

Initial fresh result: **88 passed, 0 failed, 0 skipped**, exit 0. Tests use temporary stores and mocked adapters, not the live Arcade account.

Covered by existing passing tests: integer economics and malformed money; unknown IDs and client-price tampering; idempotent design/refine/product stages; ambiguous-start reservation; known-job recovery without automatic POST; mutual admission across separate Store instances; source lineage; stale poll races; protected operator list; customer ownership/source/text checks; public projection and origin restrictions; customer attempt caps; gateway path/method/Host/query/body/header/timeout limits; Shopify variant mapping, currency/price/discount/subscription rejection, unsupported and empty baskets, dedup; widget explicit generation, persistence-before-POST, same-ID recovery, reload GET, stale source/text gating, no fake overlay, disabled capability.

### Fresh live API checks without writes

- Local quote Weekend: basket 99900, pre-campaign contribution 46000, creator 6000, platform 2000, subsidy 8000, fan 6000, retained 30000 (all USD cents).
- Local quote Adventure: basket 129900, pre-campaign contribution 52000, creator 6000, platform 2000, subsidy 14000, fan 0, retained 30000.
- Public quote through HTTPS with Shopify Origin: 200, exact `Access-Control-Allow-Origin: https://arcade-creator.myshopify.com`. Returned eligible/basketTotal/productCost/subsidy/fanCopay/currency/pricingSource only; no private contribution, product purchase cost, platform fee or creator commission.
- Public catalog product keys are only id/name/price. No purchase costs. Capability is currently true; catalog includes illustrative and genuine Arcade designs, explicitly distinguished.
- Public `/api/growth/config`, `/api/growth/dashboard`, `/api/growth/personalizations`, `/.env.local`, `/api/designs/categories`: all 404.
- Unapproved Origin on public config: 403 with no CORS allow-origin.

### Fresh browser checks

- Local fan loads real Arcade original image (natural width 1024), no page errors in tested default flow.
- Text entry `QA test` generates zero personalization POSTs. Generate becomes available for a valid creator/source, while actual image remains original.
- Invalid creator URL disables both Generate and simulation, shows preview-only message.
- Local mobile width390 has document scrollWidth390 (no horizontal overflow). This is desktop Chrome emulation, not a physical phone result.
- Current studio exposes collection prompt and Generate base, existing collection dropdown, and personal variant controls. New creator product/category/collection management flow is under active redesign; it has not been signed off. `testing-agent/studio-current.png` records baseline.

## Deliberate limitations and follow-up

- No fresh authenticated Shopify browser QA here: password/access and installer browser belong to installer. Their prior Shopify reports are not represented as independently reproduced by this tester.
- Thumbnail picker, new creator product flow and safe customer-error changes need post-change retesting.
- Current process uses narrow persistent generation caps; all past attempts count. A true capability flag alone does not establish available generation capacity. New creator creation can be blocked by global reservation or exhausted base-design budget.
- Gateway rate limit is per direct socket IP, so ngrok visitors share its 180/min budget. Config polling alone is 20 requests/min/visible widget; personalization polling adds 24/min. This is a controlled demo, not load-tested public scale.
- No physical iPhone/Android, screen reader, keyboard-only full journey, offline startup on actual Shopify, hostile fuzzing, or broad load testing completed.
- No actual order/payment/manufacturing/payout claims are warranted.

## Reversible archive UI follow-up (fixture-only)

Creator UI was subsequently extended to private collection administration. Independently exercised its actual HTML in isolated Chromium with all requests intercepted: existing create/recovery lifecycle still passes; remove selected updates the gallery and clears only unsaved personal text; remove final active item shows empty collection and hides preview while keeping new generation available; Restore returns and selects the original. Exactly three archive/restore requests hit fixture handlers, not the real service. No page errors; mobile DOM remains390px.

Real archive API/server rollout and persistence are a separate parent-owned acceptance step; do not infer implementation or live success from mocked UI behavior. Compatibility fallback is separately tested to use public catalog only for a404 from the not-yet-installed private API, never for500.

## Parent live acceptance — 2026-10-11, after QA baseline

- Restarted local3100 with current session-only capability fix: actual catalog returns three supported categories, generationAvailable=true, no blocker,18 remaining before the new acceptance run. Loaded the user's previously rejected1980s draft; Generate is enabled and the editable prompt is retained.
- Real browser archive acceptance: explicitly removed Coastal trails, verified it disappeared from public rewards and persisted as archived=true in private collection; restored using the UI and confirmed both original collection items archived=false. No provider deletion or counter reset.
- User's separate Yosemite2025 request9d08de0d-06a5-44e4-9174-7bb4fb308b44 completed normally as productb5245f40-968a-421e-adc3-5ff9e88aa158. Full actual image inspected: legible integrated Yosemite2025 lettering, evidence arcade-yosemite-2025-full.png.
- New real creator acceptance run started from studio UI:1980s Memphis scarf, local design612bf2b3-5390-426f-80b2-546ce873b0aa, stable requestbcd6ed37-df43-4a29-a489-fbcb7f73880c. Outcome pending; do not claim creation succeeded yet.
- Current archive integration fixtures5/5 passed with local socket permission; prior sandbox-only EPERM was an environment restriction, not a code failure.

### Final live creator result

The real scarf acceptance run succeeded. Localdesign612bf2b3-5390-426f-80b2-546ce873b0aa maps to actual Arcade product7837c3cb-06ad-486b-8d40-6c82738209a9, original productjobproduct_build_7d86d96be7eda5993ac08ba69aa6f2c914534170f8d57842c163e228032f29ef. Returned title:100% Cotton Lightweight Gauze Scarf, Embroidered Hem. Unitprice19.41USD excludes unverified shipping/tax. Actual UI reload selects the new saved product, image loads at1550px, collection has3items, Create another design is visible, capability is ready with17remaining. Screenshot:creator-studio-scarf-live-success.png. No duplicate start after reload. Final full fixture suite113/113 passed. No order/payment/manufacturing/payout occurred.

## History, pending work and result-selection QA

Targeted after the history/progress UI handoff. The prior full-suite count is a baseline, not a claim about untested later edits. Changed backend customer-history and gateway tests were freshly run: **16/16 PASS**, including owned-session/campaign isolation, safe projection, valid and malformed query shapes, read-only repeated history reads with zero provider calls, and bounded gateway forwarding.

The actual current studio HTML ran in an isolated Chromium context with every request intercepted. Verified:

1. A running personalization shows visible progress and its current phase.
2. Selecting an older completed result preserves the active request in browser storage and continues monitoring.
3. Completion via GET does not replace an explicitly selected historical view.
4. The newly completed result is selectable and renders its own image/title.
5. Two history selections completed in reverse network order obey the latest user selection.
6. A delayed status read for A cannot override a subsequent selected result B.
7. A stale history list reporting running/refine cannot downgrade a result already known completed/product.
8. Failed product image loading hides stale imagery and displays an actionable load-error message.
9. Reloading a pending request restores progress and sends no generation POST.
10. A delayed old creator-base completion cannot override the newest collection design on restored page.
11. Explicit HTTP401 triggers one operator-session renewal and retries exactly the original serialized body/UUID. Fixture observed two identical request bodies and exactly one extra session call. HTTP500 sends one request, leaves saved recovery available, and does not automatically retry.

No real provider calls or live application mutations were made by these tests. Parent independently performed actual current-history inspection; those live results remain separately attributable to the parent, not substituted for the fixture evidence above. Public storefront history is a separate UI under installer ownership and still needs its own latest fixture/deployment verification.

### Final running-service evidence supplied by parent

Parent reports coordinated backend/gateway restart completed after active provider work. Actual local history GET for the earlier customer session returned only its two2025/2026 results; a different user's session returned only its Prague result, without operator-only rows. Gateway request with its exact Host and Shopify Origin returned200 and the same two owned results. These are parent-run live checks, separate from independent16-test ownership/gateway fixtures above.

Parent also inspected actual studio history: four entries including the then-running Prague product and three saved results; newest creator base selected; selecting actual2025 shows its generated image prominently while Prague progress remains visible. Screenshot: `studio-history-current.png`. No duplicate live read or generation was performed by this tester for that evidence.

Additional independent widget/Shopify bridge fixture run after history changes: **38/38 PASS**, covering stored/server history, pending reload, current request visibility, late history selection, wrong-result rejection, archived source visibility, progress until final image load, and prior Shopify cart invariants. Installer owns actual theme upload/readback and authenticated storefront history verification.

Restored rejected creator draft was additionally browser-tested: prompt/category are editable; next explicit click uses a fresh request UUID with the edited input. Uncertain requests retain their original ID as verified above.

Independent390px real-Chromium storefront fixture also passed: server-owned history recovers pending work when local current state is absent; active generation is visible on the preview itself; selecting an older result leaves current progress visible; completion polling does not replace the chosen older image; View current reveals the new image; busy state ends only after that image loads; reload starts zero generation POSTs. Document width390 matches viewport390. Entire request surface was intercepted, so this test consumed no provider generation and changed no live state.

## History rollout — live parent verification

The current local backend and public-only gateway now expose GET customer history requiring exactly sessionId and campaignId=main. Read-only live3100 responses returned two completed Yosemite2025/2026 entries for the original visitor session and one completedPrague entry for the second visitor session. A curl read through3200 with the exact public Host and Shopify Origin returned the same two owned entries. A Node fetch with an ineffective Host override returned403; this was corrected by sending the proper Host withcurl, not by widening gateway access.

Fresh isolated live studio browser: newest creator base selected automatically; four operator history rows loaded; Prague progress stayed visible while viewing saved Yosemite2025 in the prominent preview. No page errors and no generation calls. Evidence studio-history-current.png. The user's Prague run then completed as providerproduct11a51610-b943-48d2-85bf-33f58c5f6a19 before the coordinated safe restart.

The full combined fixture suite passed126/126 before the final widget monotonic-history and persisted-view refinements. Final Shopify upload/readback and post-refinement verification belong to the installer handoff; this count does not pre-claim those later changes.

### Final storefront acceptance

Installer confirmed the final deployed development-store widget in the actual owned Shopify session: two historical tiles(Yosemite2025/2026) restored, selecting2026 loaded the correct provider image at1024px, and reload preserved that selected image/text/pressed state. The separate latestPraha draft remained available through View current request. No generation POST was issued for viewing or reload. Screenshots:shopify-personalization-history.png and shopify-history-selected-reload.png. The final shared fixture suite passed128/128, including40Shopify/widget/bridge cases.
