# Creator Rewards × Arcade

A hackathon demo with an editable campaign, a creator referral link, an embedded widget, live events, and a saved real Arcade product.

Explore the hosted demo:

- [Demo home](https://creator-rewards-arcade.info954727.chatgpt.site/)
- [Integrated presentation](https://creator-rewards-arcade.info954727.chatgpt.site/presentation)
- [Merchant studio](https://creator-rewards-arcade.info954727.chatgpt.site/studio)

Opening a page does not start generation.

The original backend follows the [backend handoff](docs/backend-handoff.md). All monetary values in the model are **USD amounts stored as integer cents**. No real payments, orders, or payouts are processed.

To run the backend locally in the default mock mode:

```sh
npm start
```

Open `http://127.0.0.1:3000/api/demo/campaign`. Requires Node >=24; verified with 26.8.1. No npm dependencies or build step are required for the local backend. The default mode is `mock`. SQLite data is stored in the Git-ignored `data/demo.sqlite`. The service only allows loopback access.

```sh
npm test
```

Tests use a local HTTP server and SQLite, never the real provider. API reference and examples: [docs/backend-api.md](docs/backend-api.md). Implementation plan: [docs/superpowers/plans/2026-10-11-demo-backend.md](docs/superpowers/plans/2026-10-11-demo-backend.md).

In a configured environment, `.env.local` contains the server API key. **Do not overwrite an existing file by copying `.env.example` over it.** Add only the required settings using [.env.example](.env.example) as a reference. `DEMO_OPERATOR_TOKEN` enables protected operator POST requests; neither the API key nor the token belongs in client-side JavaScript. The legacy API uses this token, while the newer local studio uses a protected same-origin operator session. Do not expose the entire local server publicly.

Read-only account verification:

```sh
node --env-file=.env.local backend/inventory.mjs
```

This command only reads categories and existing products; it does not create a job. The snapshot remains in the Git-ignored `data/arcade-inventory.json`. `ARCADE_MODE=live npm start` loads category options; generation starts only through an authorized `POST /api/designs`. Each design involves two provider steps and counts toward the persistent `DEMO_MAX_DESIGNS` limit (default: 3). Resetting the UI does not clear this limit or delete designs.

Recorded status on 2026-10-11: real Arcade product `02f5575a-78c3-41b6-9df5-b6517adc1d71` was saved and its preview was loaded in the browser. The API reported USD 40.56 per item; shipping and taxes were not verified. The USD 140 campaign cost remains a separate, editable demo assumption. UI personalization is a text preview, not an approved manufacturing specification. For the separate derivative backend, see the [live handoff](docs/arcade-live-handoff.md).

At that recorded stage, neither a public storefront nor Shopify was connected. Entering a URL alone does not install the widget. The default local service includes operator functionality and must not be exposed directly through a tunnel. A separate gateway with explicitly allowed public endpoints was being prepared for public demonstrations.
