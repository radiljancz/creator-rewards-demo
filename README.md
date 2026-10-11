# Creator Rewards × Arcade

Creator Rewards is an e-commerce prototype that connects creator partnerships with personalized product rewards. Customers explore a creator's collection and add a personal detail with Arcade; merchants configure the campaign's reward budget and contribution model.

## Explore the demo

- [Demo home and introduction](https://creator-rewards-arcade.info954727.chatgpt.site/)
- [Customer experience](https://creator-rewards-arcade.info954727.chatgpt.site/shop?creator=alex)
- [Merchant studio](https://creator-rewards-arcade.info954727.chatgpt.site/studio)
- [Integrated presentation](https://creator-rewards-arcade.info954727.chatgpt.site/presentation)

Opening a page does not start a new generation. Creating or continuing an Arcade design requires an explicit action and may consume provider usage.

## How it works

1. A merchant configures a campaign, creator commission, reward budget, and target contribution.
2. A customer arrives through a creator link and explores the creator's reward collection.
3. The basket determines the store's contribution and any customer co-pay. The customer can request a separate personalized product preview while retaining the original creator design.
4. The demo records visits, reward selections, basket changes, and simulated purchases for review in the merchant studio.

## Prototype scope

The project includes saved Arcade-generated products and personalized variants. These are product previews, not proof of manufacturing or fulfillment; designs and lettering still need review before production.

The demo does not process real payments, place orders, manufacture products, or pay creator commissions. Monetary values are modeled in USD, stored as integer cents. Example reward costs and contribution scenarios are editable assumptions, not current supplier quotes; shipping and taxes require separate validation.

The Shopify integration has been demonstrated in a dedicated development store. Self-service installation, paid-order attribution, and production checkout are not established. Opening a store URL alone does not install the widget. See the [Shopify integration handoff](docs/shopify-install-handoff.md) for the recorded setup and verification details.

## Repository guide

| Directory | Contents |
| --- | --- |
| [`backend/`](backend/) | Local Node.js and SQLite backend, Arcade adapter, generation lifecycle, and tests |
| [`prototype/`](prototype/) | Local merchant and customer interfaces, presentation, and shared reward widget |
| [`integrations/shopify/`](integrations/shopify/) | Shopify theme snippet, cart integration, and contract tests |
| [`sites/creator-rewards/`](sites/creator-rewards/) | Standalone site source, Cloudflare Worker API, D1 migration, and local preview tooling |
| [`sites/offer-release/`](sites/offer-release/) | Separate site release working copy |
| [`marketing/creator-rewards-pilot/`](marketing/creator-rewards-pilot/) | English demo film, captions, storyboard, and production assets |
| [`docs/`](docs/) | API references, implementation notes, and dated handoffs |

Dated handoffs describe the state observed at the time. Source code, local development, and the hosted demo can be at different revisions.

## Local development

Requires **Node.js 24 or newer**. The local backend has no npm dependencies or build step. From the repository root:

```sh
ARCADE_MODE=mock npm start
```

Use the development address printed in the terminal. The backend accepts loopback connections only and stores SQLite data in the Git-ignored `data/demo.sqlite`. Mock mode does not call the real Arcade provider. The local backend's operator access controls are separate from the hosted site's configuration.

To preview the standalone site with a mocked provider:

```sh
cd sites/creator-rewards
npm ci --ignore-scripts
npm run build
npm run dev
```

Use the preview address printed in the terminal. This preview uses a fake provider and ignores real Arcade keys.

## Tests

Run these commands from the repository root:

```sh
npm test
node --test integrations/shopify/*.test.mjs
npm --prefix sites/creator-rewards test
npm --prefix sites/offer-release test
```

Tests use fixtures, local databases, and mocked provider calls. Some backend tests need permission to start a local HTTP server. These commands do not establish live provider or production checkout success.

## Arcade configuration

Use [`.env.example`](.env.example) as a reference for local configuration. Keep real credentials in the Git-ignored `.env.local`; do not overwrite an existing configuration file or put credentials in client-side JavaScript. Live generation requires the relevant server configuration and available usage capacity. Generation limits persist across UI reloads.

With local credentials configured, this command reads provider categories and existing products without creating a generation job:

```sh
node --env-file=.env.local backend/inventory.mjs
```

Its output snapshot is stored in the Git-ignored `data/arcade-inventory.json`.

For implementation details, see the [backend API](docs/backend-api.md), [personalization API](docs/personalization-api.md), and [public gateway guide](docs/public-demo.md). The local backend includes operator functionality and must not be exposed directly as a public service.
