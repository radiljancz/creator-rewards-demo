# Shopify demo integration

Installed and browser-verified on **arcade-creator.myshopify.com**, development theme **test-data / 208172876113**, on 2026-10-11. Product/variant IDs, visitor access, dashboard evidence and runtime limits are in [the installation handoff](shopify-install-handoff.md). The instructions below also describe repeat installation in another authorized test theme.

The later user-requested customer-generation widget replaces the original text overlay with explicit Arcade generation. Its frontend is installed. Owned history restores completed personal designs, preserves the selected result across reload and keeps the current request separate. Visible generation progress lasts until the final image loads. Real browser evidence and remaining simulation verification are tracked in the installation handoff.

This integrates the existing Creator Rewards widget into a **dedicated Shopify development store**. It reads the actual Shopify cart and sends mapped product IDs/quantities to the campaign calculator. No OAuth app, Admin API access token, checkout extension, or app review is needed for this theme prototype. It does not place orders, collect payment, add the reward to Shopify checkout, or start Arcade production.

## Recommended two-hour path

Use the new dev store that the user is creating. Install the snippet into its demo theme. Share the storefront creator link **and its storefront password** with judges; each person uses their own real Shopify cart and can simulate the reward selection. A visitor sees the creator's generated product, enters optional text and explicitly generates a derivative with Arcade. The image shows progress and then replaces both preview and thumbnail with the final provider image. This does not order or manufacture it.

Estimated work after access is available: **20–40 minutes for theme installation, product mapping and browser verification**, plus the separately owned public HTTPS gateway. A newly created empty store may add another 20–30 minutes for two products and storefront setup. These are estimates, not verified completion times.

For a new installation, required dependencies are:

- The actual `myshopify.com` domain and access to its theme editor.
- A public HTTPS **public-only gateway** URL supplied by the parent implementer. It must serve `/rewards.js` plus the widget's public API routes. Do not expose the loopback admin, operator-session, designs, or generation endpoints to anonymous visitors.
- The campaign shop URL / CORS origin set to the exact storefront origin used by visitors. If Shopify redirects to another hostname, that resulting origin must match.
- USD products whose storefront prices match the configured campaign model.

## Installable files

- `integrations/shopify/creator-rewards.liquid` → theme `snippets/creator-rewards.liquid`.
- `integrations/shopify/creator-rewards-shopify.js` → theme `assets/creator-rewards-shopify.js`.
- `prototype/rewards.js` → theme `assets/creator-rewards-widget.js`.
- `backend/assets/coastal-pillow.svg` → theme `assets/creator-rewards-coastal.svg`; the snippet passes its Shopify CDN URL for the illustrative design.
- In `layout/theme.liquid`, just before `</body>`, add:

```liquid
{% render 'creator-rewards' %}
```

Edit the snippet's public JSON configuration:

1. Set `backendOrigin` and widget `data-api-origin` to the **actual HTTPS gateway origin**, no path, query, credentials or custom port. Current values belong to the arcade-creator demo.
2. For another store, replace the configured numeric Shopify variant IDs, kept as JSON strings. Map them to `weekend` / `adventure`, or IDs configured in the merchant UI. Variant mapping takes precedence over product mapping.
3. Optionally map a Shopify product ID under `mapping.products`. Do so only if every variant used in the demo has the same configured economic model and price. Prefer explicit variants.
4. Keep campaign `main`.

For the seeded model, create two USD demo products priced **$999** and **$1,299**. Configure their costs in the merchant UI as $539 and $779, respectively. Do not enable discounts, subscription selling plans, automatic currency conversion or additional unmapped items for this demo path. These constraints prevent presenting the wrong contribution model as a real Shopify calculation.

A simple way to find the selected variant ID is to add that product to the cart and inspect the same-origin JSON at `/cart.js` (or the locale-aware equivalent); `items[].variant_id` and `items[].product_id` identify the line. This JSON contains cart information: do not send its token or customer-related data to the rewards backend. The bridge sends only configured product IDs and quantities.

Example visitor link, after replacing the placeholder shop domain:

```text
https://YOUR-DEMO-STORE.myshopify.com/?creator=alex
```

Use the actual campaign creator ID if changed from `alex`. Open a fresh private browser for the visitor test. If Shopify's password step drops the query string, open the complete creator link again after unlocking the store.

## Behavior and boundaries

- Uses the documented locale-aware URL `window.Shopify.routes.root + 'cart.js'` with same-origin credentials. Shopify Ajax API needs no access token and only works in a Shopify-hosted theme.
- Reads the cart every two seconds while visible and when the page becomes visible. It does not patch the theme's `fetch`, XHR or cart actions.
- Aggregates split cart lines mapped to the same configured product. Stable fingerprints avoid sending a basket event on unchanged polls. Quantity limits match the current backend: ten items, each at most ten units.
- Unknown products, mismatching final prices/cart totals, another currency, subscription lines, or unsupported quantities clear the reward basket and show an explanation. It never silently excludes unknown items while presenting the full cart as eligible.
- On cart fetch failure, the old basket benefit is cleared. A subsequent successful poll recovers. If widget startup itself fails, Retry connection restores both configuration and cart syncing when the service recovers.
- Polling can lag a cart change by approximately two seconds. The visible benefit remains a **demo estimate from configured costs**, not a verified order/discount promise. The user can invoke `window.CreatorRewardsShopify.refresh()` for an immediate read.
- The existing widget provides visit, selection and simulated-checkout events. Delivery is browser reported and best effort; no Shopify order webhook, paid conversion, affiliate payout or verified attribution exists in this scope.
- Shopify native checkout is separate. The widget's button only records the simulation. In a dev store, any later native checkout test must use a supported test gateway; no real transaction is required.
- No provider keys, Shopify admin token, order data or cart token are put in the snippet or transmitted by the bridge.

## Acceptance on the actual store

1. From a second device/private browser, open the creator link, enter storefront password, confirm widget loads over HTTPS without CORS errors.
2. Add the $999 mapped product: real Shopify cart updates; the reward model displays $60 fan contribution and $80 merchant subsidy.
3. Replace it with the $1,299 mapped product: display becomes $0 / $140. Do not leave both in the cart when comparing the two seeded examples.
4. Choose the actual Arcade reward, add short custom text, explicitly Generate with Arcade and wait for the final provider image before running the labeled simulation. Parent dashboard must show the event's actual shop origin, with `orderPlaced`, `paymentOccurred`, and `payoutsOccurred` all false.
5. Change quantity, remove the product, and add an unmapped product. Verify stale rewards clear and no duplicate basket events appear while leaving the cart unchanged.
6. Disable the gateway temporarily; verify visible failure and no stale benefit. Restore and check recovery/reload as described above.
7. Confirm the public gateway rejects private config/dashboard/session/generation routes. Never claim this acceptance complete from unit tests alone.

## Preview alternative and access facts

A dedicated dev store is preferred here. Shopify documents that dev stores are always password protected and visitors can access them with the storefront password. The password cannot be removed merely for the hackathon. The store can hold test products and process test orders; real transactions are unsupported for testing. [Shopify dev-store documentation](https://shopify.dev/docs/storefronts/themes/tools/development-stores).

If an existing store is used instead, a separate unpublished theme has a shareable **visitor preview**, currently valid for two days and using a `shopifypreview.com` hostname. Merchant preview URLs require admin authentication. The actual visitor origin must match gateway CORS and campaign config; do not assume it equals the store's primary domain. Preview access does not establish checkout support or permission to alter a live theme. [Shopify theme previews](https://help.shopify.com/en/manual/online-store/themes/adding-themes).

API references: [Shopify Ajax API](https://shopify.dev/docs/api/ajax) and [Cart API](https://shopify.dev/docs/api/ajax/reference/cart). Cart monetary values use the presentment currency; this bridge validates USD and configured final line totals to avoid accidental currency/discount mismatch.

## Local verification

```sh
node --test integrations/shopify/creator-rewards-shopify.test.mjs
node --check integrations/shopify/creator-rewards-shopify.js
```

Six pure mapping/deduplication tests cover merged lines, unknown mappings, price/currency/subscription/quantity mismatch, deleted model products, stable fingerprints and empty carts. These passed locally. The actual development store also passed theme/CDN loading, real cart $60/$0, stale-benefit clearing, visual text, dashboard simulation with Shopify origin, and a 390 × 844 browser viewport. Physical-phone and fresh-private-context checks remain unperformed. See the installation handoff for exact evidence and gateway uptime dependencies.
