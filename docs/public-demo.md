# Live handoff — 2026-10-11

- Public HTTPS origin: `https://luann-swampiest-georgianna.ngrok-free.dev`
- Visitor URL: `https://luann-swampiest-georgianna.ngrok-free.dev/shop?creator=alex`
- Fixed gateway upstream: `http://127.0.0.1:3100`; gateway listener: `127.0.0.1:3200`.
- Tunnel started with `ngrok http http://127.0.0.1:3200 --inspect=false`.
- Browser verified through public HTTPS: actual Arcade image loaded (1024 px), co-pay $60 → $0, personal preview text, simulated completion; no console errors.
- Public HTTP verified: shop, widget JS and public campaign 200; config, dashboard and `.env.local` 404. Local gateway checks also proved session/design POSTs 404 and wrong Host 403.
- Shopify install follow-up: read `docs/shopify-public-handoff.md`; free ngrok blocked fresh cross-site script loading, so upload the widget JS as a Shopify theme asset and use its new data-api-origin attribute.
- Target test storefront: `https://arcade-creator.myshopify.com`. Local campaign main shopUrl (revision 4) and running gateway SHOP_ORIGIN now match this exact origin. Actual Shopify browser/widget/cart integration remains pending; no production store was modified. Any redirect to another origin requires separate verification and a coordinated configuration update.
- ngrok free browser interstitial requires first-time visitors to click Visit Site. Widget API fetches now send ngrok's documented `ngrok-skip-browser-warning` header only on ngrok domains, because credentialless fetches otherwise received interstitial text. Gateway CORS allows that one extra header; it is not forwarded upstream. Eight gateway tests pass after this change.
- Availability depends on the Mac, backend, gateway and tunnel processes staying awake/running. This is an ephemeral hackathon demo, not deployed production hosting.
- After obtaining exact test storefront origin, set campaign main shopUrl locally and restart gateway with matching `SHOP_ORIGIN`. Verify exact CORS and real Shopify-origin event before claiming integration works.

# Public demo gateway — temporary public demo

The gateway exposes the fan storefront and its public tracking endpoints. Merchant configuration, dashboards, operator sessions, design generation, legacy APIs and local files remain inaccessible through it. It does not load `.env.local`, read provider keys, start Arcade work, create orders or make payments.

## Local startup

The existing backend must already be running on `http://127.0.0.1:3100`. The gateway executable has this fixed upstream; a request cannot change it. The constructor accepts a different loopback port only for local integration/tests.

Set the exact public HTTPS origin that the tunnel will use, without a trailing slash or path. Replace the example domain with an endpoint assigned to your ngrok account:

```sh
PUBLIC_DEMO_ORIGIN='https://YOUR-ENDPOINT.ngrok.app' node backend/public-demo.mjs
```

This binds only `127.0.0.1:3200`. It creates no tunnel. `PUBLIC_DEMO_PORT` optionally changes the listening port. Plain requests to `localhost:3200` fail Host validation; that is intentional. To test locally using the allowed public Host:

```sh
curl -H 'Host: YOUR-ENDPOINT.ngrok.app' 'http://127.0.0.1:3200/api/growth/public?campaign=main'
```

For an actual Shopify storefront, set its exact visible origin in both the merchant configuration (`shopUrl`) and gateway environment. Preview iframe origins or the Shopify admin origin are not equivalent to the storefront:

```sh
PUBLIC_DEMO_ORIGIN='https://YOUR-ENDPOINT.ngrok.app' SHOP_ORIGIN='https://YOUR-STORE.myshopify.com' node backend/public-demo.mjs
```

## Reproduction command

The installed ngrok CLI supports this syntax (`ngrok http --help` inspected). Account authentication and endpoint ownership must already be configured locally. Do not paste an auth token into chat or this document.

Only after explicit approval to expose the demo, run in another terminal:

```sh
ngrok http http://127.0.0.1:3200 --url https://YOUR-ENDPOINT.ngrok.app --inspect=false
```

Point the tunnel at **3200**, never the backend's 3100 port. Keep the public Host header intact. Share `https://YOUR-ENDPOINT.ngrok.app/shop?creator=alex`; `/` deliberately returns 404. The Shopify snippet can load `https://YOUR-ENDPOINT.ngrok.app/rewards.js` without an Origin header on the script GET. A visitor may need to pass any ngrok interstitial before opening the demo; verify in a fresh browser before presenting. The original gateway preparation did not publish anything; the later live handoff at the top records the current temporary tunnel.

## Allowed surface

| Method | Path |
|---|---|
| GET | `/shop` with optional `creator` query |
| GET | `/rewards.js` |
| GET | `/assets/coastal-pillow.svg` |
| GET | `/api/growth/public?campaign=main` |
| POST | `/api/growth/quote`, `/api/growth/events` |
| OPTIONS | The three public API paths |

The public-origin events are forwarded as loopback-origin observations. They mark `demoConnected`, never `shopConnected`. A configured Shopify origin is retained and the backend independently checks its configured shop origin. These remain browser-reported observations, not verified humans, sales or affiliate payouts.

All quote responses, including nested event quotes, omit merchant margin, campaign budget, creator commission and platform fee. Cookies, authorization, forwarded headers, referrers and upstream cookies are never proxied. Private backend errors are replaced with a generic error.

Bounds: 16 KiB request bodies, 1 MiB upstream responses, 5-second upstream deadline, 180 requests/minute per direct socket IP, and at most 1,000 rate buckets. Forwarded client IP headers are intentionally ignored. A local tunnel normally shares one socket IP across visitors, so this is a shared demo limit. Polling rapidly from many tabs can exhaust it; the gateway is for a small hackathon demo, not production hosting. The existing backend also applies event/session limits.

## Verification

```sh
node --test backend/test/public-demo.test.mjs
node --test backend/test/*.test.mjs
```

Tests use an actual loopback gateway and mock-mode backend. They cover storefront access, public quotes/events, sensitive field removal, demo/shop origin classification, denied private paths/Hosts/origins, credential/header stripping, loopback-only upstream validation, body limits, rate limits and upstream timeout. They make no provider calls and start no external listener.

After publication, separately verify the public URL, private-path rejection, fresh-browser script loading and an actual Shopify browser event before claiming external integration works. Standalone public access is now verified as recorded above; actual Shopify integration remains unverified.
