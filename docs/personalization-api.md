# Operator personalization API

Implemented 2026-10-11. Node >=24, existing SQLite Store and local `growth_operator` session. No frontend, Shopify or public-gateway changes in this backend work.

## Availability and authentication

`GET /api/designs/categories` retains `{mode,items,generationAvailable}` and adds **`personalizationGenerationEnabled: boolean`**. This is the effective Personalizations manager flag: true only when the app has live mode, a provider adapter and explicit `PERSONALIZATION_GENERATION_ENABLED=true`. It defaults to false; no environment file was changed. UI should stay disabled when this field is false **or absent**.

On the local merchant-studio origin, obtain/reuse the existing session with `POST /api/growth/session`, JSON `{}`, `credentials:'same-origin'`. The HttpOnly `growth_operator` cookie has Path `/api/growth`, SameSite=Strict, four-hour expiry and is invalidated by restart. Reacquire it after restart. Do not put provider keys or the legacy bearer token in the frontend.

All personalization endpoints below require that session, including GET. POST requires exact local Origin and `Content-Type: application/json`; same-origin GET may omit Origin, but cross-site GET is rejected. Request body limit is 16 KiB. These endpoints have no external CORS permission. The public gateway's unchanged explicit allowlist rejects session and personalization paths with HTTP404, even if a client sends an operator cookie. This is a **local demo operator session**, not a customer account or production authentication system.

## Endpoints

| Method/path | Input | Success |
| --- | --- | --- |
| `POST /api/growth/personalizations` | `{sourceDesignId,text,requestId}` | 202, state below |
| `GET /api/growth/personalizations` | No body | 200, `{items:[...stateWithRequestId]}`, newest first |
| `GET /api/growth/personalizations/:personalizationId` | No body | 200, state below; persistence read only |
| `POST /api/growth/personalizations/:personalizationId/resume` | Exact JSON `{}` | 202, state below |

The protected list lets a fresh local browser recover stored results after obtaining the existing operator session. Each item is exactly the safe state below **plus `requestId`**, the local application idempotency key needed for UI restoration. It includes no nested input, provider POST body, mask or secret. Items are ordered by stored `createdAt` descending; an empty table returns `{items:[]}`. Records without a valid creation timestamp sort last. Both list and individual GET are persistence reads only, available regardless of the generation flag: neither polls the provider nor calls kick/create/resume. The list has the same operator-session and local-origin checks as individual GET; no public CORS, and the public gateway denies this path too. No provider request ID is substituted for the local `requestId`.

Create input example using the existing real Desert trails creator design:

```json
{
  "sourceDesignId": "60ef47fd-30c8-40ed-b2cd-ac07fdde763a",
  "text": "Yosemite 2026",
  "requestId": "customer-yosemite-2026-v1"
}
```

This example is a contract, not permission to run it.

- `sourceDesignId`: local persisted design ID, at most128 UTF-16 code units before trimming. For a completed generated creator reward, this equals `GET /api/growth/public?campaign=main` → `rewards[].id`. **Do not send the provider product ID or pattern ID.** The source must exist in SQLite, be succeeded/live, have Arcade provenance/job ID and original category/selections. Seed illustrations and customer personalization IDs cannot be sources. The backend determines all provider IDs, category, selections and mask.
- `text`: nonempty string, at most32 UTF-16 code units before trimming. Allowed characters: Unicode letters/numbers, ordinary spaces, `. , ' ’ -`. Examples: `Yosemite 2026`, `Praha 2026`. Markup, newlines, emoji and arbitrary instructions are rejected. The text is a label request; generated spelling/appearance needs visual review.
- `requestId`: nonempty stable application key, at most128 UTF-16 code units before trimming. Reuse the same key and same normalized input for retries/reloads. A matching request returns the existing personalization ID/state; changed source/text with that key returns409. Do not invent a new key to work around a timeout.
- No other input fields are accepted. Resume cannot change source, text, mask or provider request ID.

Create and resume are blocked with403 while generation is disabled. GET remains usable. Maximum persisted personalizations is1 by default (`DEMO_MAX_PERSONALIZATIONS`, bootstrap accepts0–100); failed/succeeded attempts count toward this total. A replay of an existing request does not consume another slot. No HTTP endpoint changes the flag or resets this limit.

## Exact response shape

Create, GET and resume return the same top-level fields:

```json
{
  "personalizationId": "local-uuid",
  "status": "queued",
  "stage": "refine",
  "sourceDesignId": "60ef47fd-30c8-40ed-b2cd-ac07fdde763a",
  "text": "Yosemite 2026",
  "sourcePatternId": "cmv496qb600m0pa100f58cf52",
  "refinedPatternId": null,
  "refineJobId": null,
  "productJobId": null,
  "product": null,
  "error": null
}
```

`stage` is `refine` or `product`. Nullable IDs, product and error become available as the process advances. Neither request bodies, mask data, operator session nor provider secrets are returned.

A completed `product` has these fields (values shown here are fixtures):

```json
{
  "id": "local-personalization-uuid",
  "name": "Customer pillow",
  "imageUrl": "https://example.test/customer.png",
  "imageSource": "arcade",
  "providerProductId": "customer-product",
  "providerPatternId": "customer-pattern",
  "providerJobId": "customer-product-job",
  "generatedAt": "2026-10-11T22:00:00Z",
  "providerUnitPrice": {"amount":"40.56","currency":"USD"},
  "priceIncludesShippingAndTax": false,
  "previewRetrievedAt": "2026-10-11T22:00:00Z",
  "sourceDesignId": "60ef47fd-30c8-40ed-b2cd-ac07fdde763a",
  "sourcePatternId": "cmv496qb600m0pa100f58cf52",
  "personalizationText": "Yosemite 2026",
  "visualReviewRequired": true
}
```

`providerUnitPrice` may be null; otherwise it retains the provider money object. USD product price is separate from generation-credit usage, shipping/taxes and merchant fixture economics. Existing $140 reward economics are unchanged. Preview URLs may expire; this API currently has no personalized-product refresh endpoint. GET returns the stored URL without provider calls. The parent UI may display it as a separate customer variant with its own provenance, preserving the original creator image.

## State and continuation rules

| Status | Meaning / frontend action |
| --- | --- |
| `queued` | Accepted or awaiting a stage; poll GET |
| `starting` | Persisted provider POST intent; poll GET, never create another request |
| `running` | Known job; poll GET, e.g. every2.5 seconds |
| `awaiting_product` | Read-only recovery finished refinement; show explicit Continue button |
| `awaiting_resume` | Restart preserved unstarted work; show explicit Continue button |
| `timed_out` | Deadline/read uncertainty; reservation and job IDs retained; explicit Continue reads the same job or starts only the pending stage |
| `unknown` | POST result uncertain; manual exact-request reconciliation required; resume returns409 |
| `succeeded` | Separate customer product confirmed; display it and require visual review |
| `failed` | Confirmed failed/unusable job result; terminal, resume returns the existing terminal state |

Resume requires an enabled manager and an authenticated session even for terminal states. It uses the same local ID and persisted provider keys (`:refine` / `:product`); it cannot duplicate a known job. POST input replay also requires enabled generation; while disabled, use GET for existing state.

Startup recovery polls only stored jobs and never issues refine/product creation. If recovery finishes refinement, it stops at the pending product stage until explicit resume. Unknown starts stay reserved. In mock mode without an adapter, live personalization jobs remain untouched. GET never kicks/resumes work. This work issued **no live provider calls**, and no service was restarted.

## Errors

HTTP errors have `{error:{code,message}}`. Asynchronous job failures instead appear in the200 state response as `{status,error:{code,message}}`; error details are sanitized.

| HTTP | Common code | Meaning |
| --- | --- | --- |
| 400 | `invalid_input`, `invalid_text`, `invalid_source`, `invalid_dimensions` | Invalid fields/source/text; dimension failures during asynchronous work appear in state |
| 401 | `operator_required` | Missing/expired session; reacquire locally |
| 403 | `personalization_disabled`, `invalid_origin` | Generation flag off or wrong Origin |
| 404 | `unknown_personalization`, `not_found` | Unknown ID/path |
| 409 | `request_conflict` | Same key with different input |
| 409 | `personalization_busy` | Another base design/personalization is reserved; resolve it first |
| 409 | `unknown_start` | Manual reconciliation required |
| 413/415 | `body_too_large`, `json_required` | Oversize body / wrong content type |
| 429 | `personalization_limit`, `rate_limit` | Persistent attempt limit / existing session/request throttling |
| 500/503 | `internal_error`, `personalizations_unavailable` | Internal failure / manager unavailable |

## Concurrency, persistence and scope

Admission checks and row insertion/resume use SQLite `BEGIN IMMEDIATE`. The mounted Designs manager checks personalization reservations inside its create/resume transactions, covering both legacy bearer routes and growth cookie routes. Personalization checks active base designs and other personalizations inside its transactions. Queued, starting, running, unknown, timed_out and awaiting states reserve work. Idempotent active-request replay remains safe; completed replay returns its original result.

Provider POST bodies and stable IDs are saved before dispatch. Stage advancement, failure/timeout persistence and final product writes verify current stage/job identity so a late success or rejected read from another instance cannot overwrite a newer product or release its reservation. Separate app/Store instances sharing one database are covered by tests. These guarantees apply to the mounted application; a standalone Designs manager constructed without the admission callback is outside that application boundary.

The original source design/pattern/product and the public creator collection are unchanged. The customer variant is stored only in the separate personalizations table. No order, manufacturing, checkout, payment or payout operation exists in this flow.

## Delivery and one subsequent live test

Changed: `backend/server.mjs`, `growth.mjs`, `main.mjs`, minimal `designs.mjs` guard, `personalizations.mjs`, new integration tests and these docs. No frontend/Shopify/public-demo source changes.

The existing3100 process still runs its earlier code. The parent owns the coordinated backend restart, using the same existing database and mode/category configuration while leaving `PERSONALIZATION_GENERATION_ENABLED` unset/false. Gateway3200 does not need a code restart for this change. After backend restart, reacquire the local operator session and verify capabilities=false. This is restart readiness, not proof that the running service already exposes these endpoints.

One later live test needs direct approval for one refine→product operation, then explicit server flag enablement, a coordinated backend restart, a fresh local session and one stable request against the existing Desert trails source. Do not enable now, raise limits, reset data or run another base generation. Review the completed derivative image/provenance; no order/payment is part of the approved generation test. Restore the disabled flag afterward through the parent-owned restart process.

Operational blocker confirmed read-only in the existing SQLite database: another live base design `806f7fb1-e541-491e-ab56-0112322f5d78`, request `bfe4e26b-cf0e-44a6-b0dc-ec661c5dd6b7`, is `unknown` at the product stage, with pattern job `67b0cf2b-3e1f-4b40-af80-9043284c2d6c`, pattern `cmv49cf5800l3lg10xigviq5b` and no stored product job ID. Its reservation must remain in place: an enabled personalization attempt will return409 `personalization_busy` until the original generation is reconciled. Do not delete/reset it, bypass the guard, issue a new create or replay its POST without direct authorization. The main chat is examining provider inventory read-only; this does not prevent the Shopify demo from using the already-completed creator product.

Parent-reported update on2026-10-11 supersedes the earlier restart-pending status: backend3100 was restarted by the main chat, capabilities=false verified, UI disabled and no personalization run. Read-only inventory (`data/arcade-inventory.json`) contains existing provider product `8a652ab0-a36d-4143-9563-8342f3d7a8bd` for the unknown pattern above, in category `e31ea74b-f8a6-42f1-b005-c67ea65faecf`, but no job ID/request ID. The unknown reservation therefore remains; no database update or create/replay POST was made. This backend chat only records the reported evidence and makes no additional provider call. The primary Shopify flow is unaffected.

## Hackathon allowance correction — 2026-10-11

The visitor-specific hardcoded two-attempt guard was replaced with the existing configured `maxPersonalizations` allowance. This does not raise the global allowance or reset persisted attempts. A third request in the same session is now admissible when the global configured allowance remains available; all sessions together still share that global limit. Existing request replay remains idempotent at the limit. The runtime change was loaded after the user's creator job completed on2026-10-11 at21:38:51UTC; local3100 is ready with both personalization flags enabled and global max20. No rejected Praha request was automatically retried. Regression and lifecycle fixtures15/15 passed; no provider generation was used for those tests.
