# Creator collection archive API

Archiving removes a product from the published collection and restoration returns it. These actions use the existing local `growth_operator` HttpOnly session cookie and exact local origin. The public gateway returns 404 for all collection-management paths, even with an operator cookie. No provider request, order, payment, manufacturing or job cancellation occurs.

| Method and path | Body | Response |
| --- | --- | --- |
| `GET /api/growth/collection` | None | 200 `{ "items": [ { ...product, "archived": false } ] }` |
| `POST /api/growth/collection/:id/archive` | `{}` | 200 `{ "productId": "id", "archived": true }` |
| `POST /api/growth/collection/:id/restore` | `{}` | 200 `{ "productId": "id", "archived": false }` |

The private list includes the seed illustration and every stored base product, including archived items. It does not include customer derivatives, which retain their existing separate personalization API. Item IDs are local collection product IDs, not provider product IDs. Path IDs use 1–128 letters, digits, hyphens or underscores. Mutation bodies accept no extra fields. Unknown collection IDs return 404 `unknown_product`; no valid session returns 401 `operator_required`; wrong origins return 403 `invalid_origin`. There is no public CORS for these paths.

Archive and restore are idempotent, including restoring an item that was never archived. Flags are persisted in separate SQLite rows keyed by product ID and changed inside an immediate transaction. Concurrent changes to different IDs cannot overwrite one another. Archiving never deletes a design, product, provider job/request ID, attempt counter, completion, event or statistic, and it does not increase remaining generation allowance.

Archived products are omitted from `/api/growth/public?campaign=main` rewards and `/api/demo/campaign` collection products. New growth quotes, reward selection events, simulated checkouts and legacy demo quotes/completions reject archived product IDs. Customer create rejects an archived source with the existing 400 `invalid_source`. New base products keep appearing through the existing collection projection.

Already stored customer variants remain readable through their existing authorized/capability-bound endpoints. Archiving does not cancel an active generation or modify its persisted state, job IDs or resume rules. Historical event and completion rows remain intact. An exact replay of an already accepted event or completion still returns its stored result after archiving; a new event ID or completion request key must use a published product. Conflicting event replay input still returns 409 `event_conflict`.

An empty published collection is valid. The frontend should show an empty state, omit reward selection and avoid quote/generation requests until the operator restores or creates a product. The private collection list still supplies archived products for restoration.

Validation uses isolated SQLite and fake provider adapters: session/origin protection, gateway denial, seed/product filtering, idempotent actions, durable state after reopen, independent archive IDs, empty collections, historical replay, source rejection, unchanged original/provider rows, and unchanged active/completed personalizations. Run `node --test backend/test/collection-integration.test.mjs` or the full backend/Shopify fixture suite.
