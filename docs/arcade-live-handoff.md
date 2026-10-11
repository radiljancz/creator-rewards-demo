# Arcade live product and personalization handoff

Owner boundary: this chat owns `backend/generate-desert-trails.mjs`, `backend/personalizations.mjs` and its tests, and these docs. The main chat explicitly reserved server/growth/main plus the minimal Designs admission guard for the user-requested mounting. Store/Arcade/prototype/Shopify/public-demo source and environment files were not changed by this mounting task. Running servers remain untouched; the main chat owns the integrated server on port3100.

## Base product — succeeded and persisted

Exactly one base generation was directly approved by the user in this chat after automatic approval initially rejected delegated authorization. One `patterns/create` request completed. The original `products/create` start was uncertain; read-only checks confirmed the pattern, then an identical body and the SAME provider requestId recovered the original succeeded product job. No new requestId or second product generation was used.

- Local design ID: `60ef47fd-30c8-40ed-b2cd-ac07fdde763a`
- Local request ID: `hackathon-desert-trails-base-v1`
- Category: Outdoor Decorative Pillows, `e31ea74b-f8a6-42f1-b005-c67ea65faecf`
- Selections: `fabric=recycled_pet`, `size=18x18`
- Pattern ID: `cmv496qb600m0pa100f58cf52`
- Pattern job ID: `c9739cca-53b4-4b20-ad84-685b11e1a8b4`
- Product job ID: `product_build_87625cfe7d27682c2d253439f6ec52e7a12ca898fe146fcaabd500fcf851d2b9`
- Product ID: `02f5575a-78c3-41b6-9df5-b6517adc1d71`
- Provider unit price: `{amount:"40.56",currency:"USD"}`; not shipping/tax delivered cost and not the demo $140 fixture.
- Generated at: `2026-10-11T20:07:18.027Z` (13:07:18 America/Los_Angeles on 2026-10-11).
- Export: ignored `data/arcade-desert-trails-result.json` with real provenance and current short-lived preview URL.
- Persistence: existing `data/demo.sqlite`; same Store/Designs modules. No second HTTP server.
- Integration proof: both `GET http://127.0.0.1:3100/api/demo/campaign` and `GET http://127.0.0.1:3100/api/growth/public?campaign=main` returned 200 with this exact provider product ID, `imageSource=arcade`, an image URL and USD unit price. This proves API exposure; it does not independently prove a rendered authenticated UI.
- Motif: abstract desert mountains/dunes and winding trail, sand, terracotta, blue-green, no text/logos.
- No checkout, manufacturing order, payment or payout.

## Personalization feasibility and contract

Current official docs were read on 2026-10-11: [edit](https://docs.arcade.ai/api-reference/refine/edit-a-pattern), [editRegion](https://docs.arcade.ai/api-reference/refine/edit-a-region), [pattern retrieval](https://docs.arcade.ai/api-reference/patterns/retrieve-a-pattern).

`POST https://platform.arcade.ai/v1/patterns/refine/edit` accepts `{requestId,patternId,instruction}` (optional `referenceId`, `colors`) and returns a pattern job. A refine creates a **new immutable pattern**, and `patterns/get` exposes `sourcePatternId`. It does not overwrite the creator's pattern. Free-form edit can alter the full design, so the instruction alone cannot prove the original composition is preserved.

Prefer `POST /patterns/refine/editRegion` with `{requestId,patternId,instruction,mask}` for the user's requirement. `mask` is a PNG data URL with the source aspect ratio (short edge tolerance 1 px), long edge <=1536; pixels with alpha>0 are editable, minimum editable region 16×16 at edit size. A small server-defined label region constrains the edit to where place/year belongs; never accept an arbitrary client instruction or mask.

Application input (protected operator/session boundary): `{sourceDesignId,text,requestId}`. Text <=32 characters, letters/digits/basic punctuation, e.g. `Yosemite 2026`. Resolve source pattern/category/selections only from the completed live design in SQLite. Retrieve its dimensions; prepare a transparent PNG mask with one small opaque label region. Then:

1. Persist refine body and stable refine requestId before POST.
2. Poll the matching pattern job with deadline, retain job ID; no automatic retry of ambiguous starts.
3. Retrieve derivative pattern; require `sourcePatternId` equal to the creator pattern.
4. Persist derivative pattern ID; create one product from it using the original category and selections, with a separate stable product requestId.
5. Retrieve product; verify its pattern ID. Keep original and derivative products separate, with source provenance.

Suggested new response: `{personalizationId,status,stage,sourceDesignId,sourcePatternId,refinedPatternId,refineJobId,productJobId,product,error}`. GET is read-only. Restart polls known jobs only; after refinement awaits explicit continuation for the product stage. Unknown start blocks another personalization. Do not automatically add customer text products to the public creator collection; let the integration choose how the session's result becomes a selected reward.

**Status:** no personalization provider job has been approved or called. Instant text overlay is a UI preview only; it is not a provider-confirmed manufacturing design. Exact glyphs/spelling and visual preservation need an actual reviewed test before claiming them.

## Delivered mounted module — generation disabled

`backend/personalizations.mjs` exports `Personalizations` and `labelMask`. It is now mounted under the existing local growth operator session, defaults to `generationEnabled=false`, and makes no provider request during import or construction. Exact frontend contract: [personalization-api.md](personalization-api.md). Persistence uses a separate `personalizations` table in the supplied Store; existing designs and public creator products remain unchanged.

Constructor options: `{store,adapter,generationEnabled=false,maxPersonalizations=1,pollMs=2500,timeoutMs=180000}`. Methods: `create(input,{authorized:true})`, `get(id)`, `resume(id,{authorized:true})`, `recover()`, `hasActive()`, `close()`. The caller must validate the operator session before supplying `authorized:true`. Enabling generation requires separate human approval for the extra refine/product work; the base-generation approval has already been consumed.

Mutual concurrency is implemented atomically inside SQLite create/resume transactions in both managers. The application covers legacy and growth base-generation paths; separate app/Store instances over one database are tested. Public GETs never create/resume work. Restart reads known jobs only; explicit resume is required for a pending product stage. Stale successful or rejected polls cannot overwrite newer stage/job state or release its reservation. The customer product remains in a separate table and is never added to the public creator collection.

Eleven isolated fixture tests pass, covering mask pixels/aspect ratio, disabled and unauthorized starts, source provenance and idempotency, input restrictions, ambiguous starts, invalid lineage, shutdown during preparatory lookup, SQLite reopening/read-only recovery, timeout/resume without repeated starts, deadline expiry before a job starts, and concurrent managers. Independent review found no remaining important defect in the module. Syntax checks passed for both new modules/scripts.

Latest combined verification on 2026-10-11: `node --test backend/test/*.test.mjs integrations/shopify/creator-rewards-shopify.test.mjs` passed **70/70**, including the now-completed public gateway and Shopify bridge. Ten new integration tests cover session/capability/origin/gateway boundaries, private/idempotent results, reciprocal admission through legacy and growth routes, separate Stores, restart continuation, unknown starts and stale successful/rejected poll responses. The fixture suite used permitted loopback listener access; no test called the live provider. Independent final review found no remaining Important/Critical finding. A pre-existing Designs concurrency test also used a real40ms fixture deadline; it now mocks Date only so CPU load does not turn its admission test into a timeout test. No production timeout or retry count was increased.

### Deterministic timeout/resume test correction

The earlier test set a real 30 ms deadline before source retrieval and synchronous PNG mask preparation, then assumed the refine job had already been created. Under the combined runner's CPU load, preparation could exhaust that deadline. The module correctly stopped before the generation POST and returned `timed_out` with `refineJobId=null`; the test's lifecycle assumption was wrong. A fixture-only reproduction with a 50 ms source lookup confirmed this exact result and zero refine starts.

The corrected test mocks **Date only** and advances time by 31 ms at the first poll of the already-persisted refine job. It verifies the same job is retained and polled after authorized resume, with exactly one refine start and one product start. A separate deterministic test advances the clock during source preparation and checks timeout with no job and no generation POST. That correction changed no retry count, timeout budget, or production module behavior. The later mounting keeps generation disabled.

**Backend delivery is complete in source.** The running3100 backend has not been restarted and still uses its previous code. The main chat owns a coordinated restart using the existing database and configuration, with `PERSONALIZATION_GENERATION_ENABLED` unset/false. Gateway3200 needs no code change. Reacquire the local cookie after restart and verify `GET /api/designs/categories` → `personalizationGenerationEnabled:false`.

Changed files: server/growth/main, minimal Designs callback/resume guard, personalizations, its unit/integration tests, one deterministic Designs test, and these handoff/API docs. No frontend, Shopify, public gateway source or environment change. No new live provider call, order, manufacturing or payment. One later approved refine→product test needs explicit flag enablement and a parent-owned restart; the prior base approval does not authorize it. Full preparation and result shape are in [personalization-api.md](personalization-api.md).

**Live-test blocker:** the existing DB also contains live base design `806f7fb1-e541-491e-ab56-0112322f5d78` in product-stage `unknown`, without a product job ID. Read-only verification confirms it remains reserved. Personalization must remain blocked until that original uncertain start is reconciled; no reset, deletion, bypass, new create or unapproved replay. The main chat owns read-only inventory investigation. The completed creator product remains usable for the Shopify demo.

**Parent-reported operational update, 2026-10-11:** the main chat completed the coordinated backend3100 restart and verified `personalizationGenerationEnabled:false`; the local UI is prepared and disabled, with no personalization run. Its read-only provider inventory found an existing product `8a652ab0-a36d-4143-9563-8342f3d7a8bd` for the unknown design's pattern `cmv49cf5800l3lg10xigviq5b`, category `e31ea74b-f8a6-42f1-b005-c67ea65faecf`. Evidence file: `data/arcade-inventory.json`. That inventory item contains neither provider job ID nor request ID; this finding does not by itself reconcile the original start. No database change or create/replay POST was made, and the unknown reservation remains. The primary Shopify flow remains usable with the completed creator product. This update records the main chat's evidence; this backend chat made no additional provider call or restart.

**Read-only reconciliation completed:** fresh products/get, patterns/get, known pattern jobs/get and products/list on2026-10-11 confirmed the matching existing product and succeeded pattern job. Current API exposes no product/request→job reverse lookup, so the original product job identity remains unproven. No generation/replay or DB change occurred. Exact missing evidence and a bounded, separately authorized reconciliation procedure: [design-reconciliation.md](design-reconciliation.md). Reservation remains unknown; this does not block the primary Shopify demo.
