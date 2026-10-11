# Shopify public endpoint handoff — 2026-10-11

Actual public API origin: `https://luann-swampiest-georgianna.ngrok-free.dev`.
Standalone visitor demo: `https://luann-swampiest-georgianna.ngrok-free.dev/shop?creator=alex`.

The standalone public browser flow is verified: real Arcade image, $60/$0 co-pay, personalized preview, simulation. Private config/dashboard/session/design and environment paths are blocked. Target test store now confirmed: `https://arcade-creator.myshopify.com`. Local campaign main shopUrl and gateway SHOP_ORIGIN are configured to this exact origin. Public API/preflight have been checked, but actual Shopify browser/widget/cart behavior remains unverified pending installation. If the storefront redirects, report the resulting origin before changing the allowlist.

## Required adjustment for Shopify installation

Fresh-browser cross-site loading of the widget script directly from the free ngrok endpoint FAILED (widget did not execute). Avoid shipping that initial loader path to judges.

Upload the current `prototype/rewards.js` to Shopify theme assets as `creator-rewards-widget.js`. It now supports `data-api-origin` for separately hosted API calls. In the Liquid snippet, AFTER the JSON config and status element but BEFORE the bridge module script, add this ordinary script:

```liquid
<script src="{{ 'creator-rewards-widget.js' | asset_url }}"
  data-api-origin="https://luann-swampiest-georgianna.ngrok-free.dev"
  data-campaign="main"></script>
```

Keep the bridge module after this script. Its existing `if (!window.CreatorRewards)` loader will skip its ngrok script injection because the Shopify-hosted widget already initialized. Keep JSON backendOrigin set to that same public origin. No API/admin secrets are needed.

The widget API uses credentialless fetch with ngrok's documented `ngrok-skip-browser-warning: 1` header for ngrok domains. Gateway allows this header in OPTIONS. Shopify CORS is now configured for `https://arcade-creator.myshopify.com` in both gateway SHOP_ORIGIN and local campaign shopUrl. Parent owns those settings. The header only suppresses the provider's informational page; it does not grant admin or generation access.

This Shopify-hosted script adaptation has not yet been exercised on the real store. After upload, verify in a fresh private browser with no prior ngrok cookies. A successful standalone ngrok page is not proof of Shopify execution.

Do not overwrite integration files concurrently. Third agent owns Shopify snippet/bridge; parent changed only widget source and this handoff.
