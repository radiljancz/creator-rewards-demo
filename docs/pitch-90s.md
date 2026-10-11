# Creator Rewards — 90-second pitch

Use the saved, successful customer result. Live Arcade generation can take several minutes; a 90-second presentation must not depend on a new job finishing.

## Before the timer

Prepare the local merchant studio, the actual Shopify development-store Weekend cart, and the browser session that owns the saved customer personalization. Preserve that session's storage. Do not switch to a fresh private window and expect the personalized result to follow.

- Merchant studio: http://127.0.0.1:3100/. One shared administration manages the creator profile, collection and economics; there is no separate creator portal.
- Shopify: https://arcade-creator.myshopify.com. Both real dev-store cart cases have been verified: Weekend $999 → fan co-pay $60; Adventure $1,299 → $0. Both retain $300 in the merchant model.
- Saved customer personalization: `cc69f854-e6f3-4322-b082-f96572189337`; resulting Arcade product `b171bef1-4167-4d7d-ade7-28ebe83209c6`. The image visibly integrates **Yosemite 2026**. Evidence: [full product image](qa/arcade-customer-product-full.png).
- Open the Shopify widget with **Open creator collection ↗**. Confirm the saved source is selected and the personalized result has been restored through its status read. Leave **Yosemite 2026** unchanged. The storefront uses design thumbnails; do not look for a visible dropdown.
- Keep the saved full product image ready as a fallback. Do not start new generation or change economics during the timed pitch.

The latest generated-personalization **Simulate this purchase →** event is still awaiting the installer's final evidence at this documentation checkpoint. Show a new event only if it actually appears; do not present its verification as complete in advance.

## Spoken script and clicks

### 0:00–0:15

> A creator brings a fan to your store. What if their reward were something personal, carrying the creator's story, with a budget the merchant controls?

**Clicks:** Start in **Store & economics**. Point to the configured creator and reward budget. Do not edit settings.

### 0:15–0:30

> Creator Rewards connects a creator collection, a tracked visit and a merchant-funded benefit. Here is the actual Shopify development-store experience.

**Clicks:** Open **Creator collection** briefly, then switch to the prepared Shopify Weekend cart. Open the widget if collapsed. Point to the design thumbnails; select the saved original's thumbnail if it is not already selected.

### 0:30–0:48

> This fan added “Yosemite 2026.” Arcade generated a separate product with that text in the image. This is a saved result; generation takes minutes, not an instant overlay.

**Clicks:** Show the restored personalized product and its Arcade provenance. Keep the text unchanged. Do not click **Generate with Arcade** or **Recover Arcade request**. If the saved session is unavailable, show the prepared full product image and explicitly call it the saved Arcade result.

### 0:48–1:06

> A $999 Weekend basket leaves a $60 co-pay. The $1,299 Adventure basket covers the model reward cost. Both retain $300 contribution for the merchant.

**Clicks:** Point to Shopify's Weekend $60 co-pay. Switch to **Store & economics** and use the benefit scenario selector to show **Adventure power set**, $0 and retained $300. This second display is the merchant model preview; the matching Shopify cart case was verified before the pitch.

### 1:06–1:18

> The merchant can inspect browser activity and model economics. Purchases and commissions remain simulated; no payment or manufacturing occurs.

**Clicks:** Open **Live activity**. Show actual recorded browser observations. If the installer has supplied the final generated-personalization simulation evidence, point to that matching saved event. Otherwise do not claim it exists or spend the presentation troubleshooting it.

### 1:18–1:30

> Next, one store and one existing creator partner. We measure contribution per referred visitor against today's affiliate offer.

**Clicks:** Keep the dashboard visible and finish. No Shopify checkout or new generation.

## Short fallback

If Shopify or the tunnel fails:

> “The external connection is unavailable. This is the saved Arcade result; I will show the economics in our local demo.”

Use the prepared product image, then the merchant scenario selector. The standalone local storefront at http://127.0.0.1:3100/shop?creator=alex can show the original collection and live model quotes. It does not inherit the Shopify browser session's saved personalized variant; do not claim that it does. Any events from it are local demo events, not Shopify events.

If the local backend also fails, show the already-loaded product evidence and say that no new live event is being demonstrated. Do not restart, reset data or generate replacements on stage.

## Three likely jury questions

1. **“Is the personalized product real?”**

   “Yes: Arcade returned a separate customer product, and we visually checked the integrated ‘Yosemite 2026’ text. It preserves the stored creator original as a separate asset. This is a generated product preview, not proof of a manufactured item or a purchased order. Production suitability still needs review.”

2. **“Who pays for it?”**

   “The merchant's modeled contribution budget funds the benefit after creator commission and platform fee. Weekend allocates $80 to the reward and the fan contributes $60; Adventure allocates $140 with no fan co-pay. Both retain $300 modeled contribution. Arcade's $40.56 unit quote is separate from our $140 assumed total reward cost; shipping and tax are not established by that quote.”

3. **“Is it ready for any shop or creator?”**

   “This is a working integration on a dedicated Shopify development store, with one shared merchant administration and a creator collection. It is not yet self-service installation or a separate creator portal. We have not measured conversion uplift or verified paid-order attribution. The next step is a focused existing-partner pilot.”
