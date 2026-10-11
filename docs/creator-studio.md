# Operator creator studio API

The shared local studio creates a new creator design and a product using the existing pattern → product lifecycle. This is an operator action through the existing `growth_operator` session, not a new creator account or role. The public storefront gateway does not expose the studio or base-generation endpoints.

## Catalog

`GET /api/designs/categories` is a local-origin, read-only endpoint. It does not call Arcade, poll a job, start generation or require a provider key in the browser. The live startup adapter resolves category IDs from `categories/list`, then obtains complete default selections with `categories/get`. Supported families are pillows/cushions (outdoor first, or the configured preferred pillow), scarves and tea towels, with at most one available category per family. Unavailable, non-print, non-manufacturable or incomplete categories are omitted. No category IDs or selections are invented. A completely unavailable catalog disables new generation.

Response:

```json
{
  "mode": "live",
  "items": [
    {
      "categoryId": "provider-inventory-id",
      "name": "Outdoor Decorative Pillows",
      "world": "print",
      "canManufacture": true,
      "imageUrl": "https://provider.example/preview.png",
      "selections": { "fabric": "default", "size": "default" },
      "options": [
        { "key": "size", "label": "Size", "values": [{ "value": "default", "label": "Default", "available": true, "isDefault": true }] }
      ]
    }
  ],
  "generationAvailable": true,
  "generationBlocker": null,
  "remainingDesigns": 3,
  "maxDesigns": 3,
  "activeGeneration": false,
  "personalizationGenerationEnabled": false
}
```

Example IDs/defaults above are placeholders. Render the returned categories and send their exact `categoryId`. `imageUrl` is an HTTPS thumbnail or `null`; optional option/value labels and `isDefault` can be absent. Items expose only category metadata, default selections and option metadata, never the operator token or a private provider request body.

`remainingDesigns = max(0, maxDesigns - count of persisted designs in the current mode)`. Failed designs also consume the persistent limit. `activeGeneration` includes every reserved base design or personalization, including unknown starts and jobs awaiting explicit resume. `generationAvailable` expresses deployment capability and current admission state; it does not authenticate the browser.

The UI can display `generationBlocker`: `category_unavailable`, `provider_unavailable`, `personalization_busy`, `design_busy`, `design_limit`, or `null`. These are evaluated in that order. The live deployment needs an adapter, a nonempty validated catalog, and the existing local operator session for submission. The legacy bearer token does not control the shared studio capability metadata. This metadata is a snapshot: a new POST still performs atomic admission against SQLite.

## New creative and product

1. Reuse the operator session established by `POST /api/growth/session {}` from the exact local origin. The HttpOnly cookie authenticates studio writes; do not put the operator bearer token in frontend code.
2. `POST /api/growth/designs` with the cookie and JSON `{ "prompt": "Forest sketches", "categoryId": "catalog-id", "requestId": "stable-local-key" }`. Prompt is nonblank and at most 1000 characters; request key is nonblank and at most 128 characters. Send no prices, provider IDs, custom selections, masks or provider bodies.
3. HTTP 202 returns the existing design state: `{designId,status,stage,mode,error,providerJobId,product}`. Poll `GET /api/designs/:designId`, which only reads stored state. Statuses and recovery retain the existing design API contract.
4. A succeeded base product appears in the existing creator collection via the stored products projection. Customer personalization derivatives still use their separate lifecycle and collection rules.

The backend selects category defaults from the startup catalog and saves an independent category snapshot in the new design row before dispatch. Restart recovery and explicit resume use that persisted category, even if the new catalog removed the category or changed its defaults. A replay with the same request key and input returns the same design before catalog/admission checks; conflicting input returns HTTP 409 `request_conflict`. Unknown category IDs return HTTP 400 `unsupported_category`; extra client fields return HTTP 400 `invalid_input`.

The legacy local `POST /api/designs` bearer-authorized endpoint remains compatible with the same request body. Existing session-protected resume and legacy resume routes preserve job IDs, the mutual generation lock, and unknown-start reconciliation rules. No automatic POST retry is added. Reads and process recovery cannot create an extra pattern or product.

## Operations and validation

`Arcade.demoCategory(preferredId)` remains available for older one-category callers. `demoCategories(preferredId)` supplies the studio catalog. Optional server/Designs `categories[]` falls back to the existing `category` argument when omitted; an explicit empty array disables new category selection. Mock startup retains its single illustrative category and makes no provider call.

The Arcade request timeout defaults to 180 seconds and remains explicitly overridable. Increasing that timeout does not retry an uncertain start or change provider idempotency keys. No new environment flag, production deployment, provider generation, payment, order or manufacturing action is part of this change.

Fixture tests cover runtime inventory IDs, supported families, omitted invalid categories, safe thumbnails, server-only selections, immutable category persistence after restart, session authorization, existing request replay, persisted mode-specific limits, both kinds of active reservation and disabled capability. Run `node --test backend/test/*.test.mjs integrations/shopify/*.test.mjs` for backend/customer/gateway/widget coverage.
