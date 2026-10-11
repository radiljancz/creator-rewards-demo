# Customer personalization history

`GET /api/growth/customer-personalizations?sessionId=UUID&campaignId=main`

Both query fields are required exactly once, with no extra fields. `sessionId` is the existing visitor UUID capability; `campaignId` must match the configured campaign ID (`main`). Query field order can be reversed. The public gateway requires literal UUID/main values and rejects extra, duplicate or encoded query forms. The existing item GET still takes only `sessionId`; create/resume request contracts are unchanged.

Success is HTTP 200 `{ "items": [state] }`. Each item is the existing safe personalization state plus `createdAt: string | null`:

```json
{
  "items": [
    {
      "personalizationId": "saved-personalization-uuid",
      "status": "succeeded",
      "stage": "product",
      "sourceDesignId": "original-local-design-id",
      "text": "Yosemite 2026",
      "sourcePatternId": "original-pattern-id",
      "refinedPatternId": "derived-pattern-id",
      "refineJobId": "saved-refine-job-id",
      "productJobId": "saved-product-job-id",
      "product": { "id": "saved-personalization-uuid", "imageUrl": "https://provider.example/result.png", "imageSource": "arcade" },
      "error": null,
      "createdAt": "2026-10-11T22:30:00.000Z"
    }
  ]
}
```

IDs and product fields above are illustrative; the product follows the existing safe item-response schema. All saved statuses are included, so the UI can also restore a pending or uncertain job. Items are ordered by saved creation time descending; missing/invalid dates sort last. A missing creation timestamp is returned as `null`.

The result contains only rows owned by the supplied customer session in the selected campaign. Operator-created variants and other visitors/campaigns are excluded. It does not expose the customer/session object, local request key, raw input, masks, provider POST bodies or operator secrets. A valid session with no owned rows returns `{ "items": [] }`.

This is a SQLite persistence read. It performs no provider poll, kick, create, resume or history write, and it works with generation disabled or an archived original. Existing rows are read after restart without migration or copying. The gateway permits only GET (or its exact GET preflight) for this query, retains its 1 MiB upstream-response bound, and keeps private `/api/growth/personalizations` paths blocked.

Origin/CORS rules match the existing customer item GET: local and configured shop origins are supported; other origins are rejected. The visitor UUID is a demo capability, not an account login. Keep and reuse the existing visitor session in the browser; a new session cannot discover the old session's history. No operator cookie or bearer token is required or forwarded. Invalid query/campaign/session returns backend 400 `invalid_input`; a disallowed gateway query/path returns 404, and a disallowed origin returns 403.

Loading history or selecting a saved card must not POST a generation. Use the saved product image directly for a succeeded row. Pending/unknown rows retain their existing GET/resume and manual-reconciliation rules; history does not authorize automatic resume or an extra generation.

Fixture coverage verifies ownership and campaign isolation, excluded operator rows, chronological ordering, safe fields, empty histories, unchanged persisted rows and zero provider work, disabled-generation reads, CORS/origins, exact gateway methods/queries, stripped credentials, private-route denial and the 1 MiB limit.
