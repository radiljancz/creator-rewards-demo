# Hackathon finish line — 2026-10-11

Deliver one coherent visitor journey: creator design → real customer Arcade personalization → actual Shopify dev-store basket economics → a clearly simulated purchase event. Freeze unrelated features. This document replaces the earlier disabled-personalization and unresolved-generation checkpoint.

## Current verified scope

- One shared merchant administration owns the creator profile, collection and economics. There is no separate creator portal or creator login.
- The running backend supports three actual Arcade catalog categories: pillow, scarf and tea towel. Creator UI updates are in progress; category support does not mean three generated collection products or completed UI acceptance.
- The actual dedicated Shopify development-store cart has been verified with each mapped item alone: Weekend $999 → $60 fan co-pay; Adventure $1,299 → $0. Both scenarios retain $300 modeled merchant contribution.
- Real customer personalization `cc69f854-e6f3-4322-b082-f96572189337` succeeded, producing Arcade product `b171bef1-4167-4d7d-ade7-28ebe83209c6`. **Yosemite 2026** is visibly integrated in the generated image. Evidence: [full customer product](qa/arcade-customer-product-full.png).
- Both previously unknown provider outcomes have been reconciled against their existing work. They are no longer unresolved blockers; no replacement request keys were used for that reconciliation.
- The storefront now uses design thumbnails and actual customer generation instead of a text overlay. The stored creator original remains separate from its derivative. The installer owns verifying the latest uploaded Shopify widget, not just the local source.

These facts come from the coordinated current integration handoff and its evidence. Earlier QA snapshots may describe pre-reconciliation state; do not use those older unknown/disabled labels as the current release state.

## Remaining acceptance before the presentation

1. **Shopify installer:** finish the current real storefront **Simulate this purchase →** check using the successful owned customer variant. Confirm the saved event carries the matching personalization/product, Shopify origin and basket, with no order, payment or payout claims. This particular final check is pending evidence here; do not mark it verified merely because the API or earlier overlay simulation worked.
2. **Main chat:** finish the creator collection UI, verify its supported-category selection and current catalog, and keep the proven customer result available. Do not claim automatic product import or a separate creator portal.
3. **Presenter:** rehearse [the 90-second pitch](pitch-90s.md) using the saved result. Confirm the actual Shopify session restores it and displays the full image. Keep the full-image evidence ready in another tab.

If the final simulated-event check fails, the pitch may still demonstrate the proven generation, Shopify basket calculations and real browser observations. Describe the missing event honestly; do not replace it with a fabricated request and call that Shopify evidence.

## Operating state and ownership

- Shopify installation chat owns `arcade-creator.myshopify.com`, the theme widget/bridge, mapped variants, storefront session and final Shopify acceptance. Avoid concurrent browser or cart operation by other agents.
- Backend chat owns the generation lifecycle, admission limits, provenance and API contract. Main chat owns merchant UI, gateway coordination, acceptance synthesis and presentation.
- Main local backend: port **3100**. Public gateway: port **3200**. Public API/demo origin: **https://luann-swampiest-georgianna.ngrok-free.dev**. Shopify origin: **https://arcade-creator.myshopify.com**.
- Customer and operator personalization are enabled. Current configured persistent caps are **20 personalization attempts** and **20 base designs**; the handoff reports **18 base-design slots remaining** at this checkpoint. Old attempts count. A true capability flag alone does not prove remaining capacity or absence of active work.
- Provider request timeout is **180 seconds**; generation-job timeout is **600 seconds**. A generation can take several minutes. Use a saved successful result during the timed pitch instead of promising instant output.
- The local backend, gateway and tunnel must remain running, and the Mac must stay awake. The public gateway exposes the narrowly scoped customer flow; operator administration and operator generation routes remain private. Do not restart services independently during another agent's active check.

## Model economics and precise claims

| USD model | Weekend | Adventure |
|---|---:|---:|
| Basket price | $999 | $1,299 |
| Contribution after ordinary costs, before campaign | $460 | $520 |
| Creator commission | $60 | $60 |
| Platform fee | $20 | $20 |
| Merchant reward subsidy | $80 | $140 |
| Fan co-pay | $60 | $0 |
| Merchant contribution retained | $300 | $300 |

The **$140** reward cost is a merchant-configured total-cost assumption. The **$40.56** Arcade provider unit quote excludes unverified shipping and tax; it is not the landed cost. The **$300** retained contribution is a chosen model outcome, not proven net profit.

No real order, payment, manufacturing or payout is claimed. Browser observations and a simulated-purchase event do not prove paid-order attribution or conversion uplift. There is no self-service installation across arbitrary stores. Typing a shop URL configures the demo; it does not install a script by itself.

## Presenter sequence and fallback

Use the shared merchant setup, show the actual Shopify Weekend cart, then the saved personalized Arcade image. Compare Adventure's model economics in the merchant preview to avoid cart changes consuming the 90-second slot. Finish on real recorded browser activity and the next pilot: one existing creator partnership, measuring contribution per referred visitor.

Fallback is the prepared full product image plus the local model preview. The local storefront at http://127.0.0.1:3100/shop?creator=alex remains useful for original collection and basket interaction, but it does not automatically inherit a Shopify session's owned personalized variant. Label local events as local. Do not generate replacements or debug services on stage.
