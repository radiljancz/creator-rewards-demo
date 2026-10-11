# Creator Rewards × Arcade — standalone Sites candidate

Site project: `appgprj_6acc009166a481919a38cd4bd82432f0`.
Target URL: https://creator-rewards-arcade.info954727.chatgpt.site.
Open-studio update prepared on 2026-10-11; deployment requires separate approval.

## Experience

- `/`: merchant-facing English landing page, 59-second film, reward-budget illustration and links into the demo.
- `/shop`: fan collection, basket economics, generated finishing touch, simulated purchase.
- `/studio`: open shared studio with no access key; merchant settings, design generation, collection, personalizations, activity.
- `/presentation`: pitch with embedded fan and studio views.

Cloudflare Worker ESM hosts the complete frontend and API. D1 stores configuration,
visitor events, operator sessions, archives and durable generation jobs. It runs
independently of the local Mac after deployment. Saved snapshot includes two real
Arcade designs and three saved personalization examples. No Shopify installation,
checkout, real purchase, fulfillment or manufacturing is performed here.

## Production configuration (requires explicit approval)

Configure through Sites runtime environment tools, never source files:

| Key | Value / purpose |
| --- | --- |
| `ARCADE_API_KEY` | Secret; use existing authorized Arcade key |
| `GENERATION_ENABLED` | `true` |
| `MAX_DESIGNS` | `20` total, including two snapshot designs |
| `MAX_PERSONALIZATIONS` | `20` shared total, including three saved examples |

The proposed limits admit 18 new designs and 17 new personalizations. Admissions
reserve slots permanently, including failed or uncertain attempts; archival does
not refund slots. Creating or continuing generation requires an explicit user
click. Reload reads saved state without provider writes. Repeated requests reuse
the same identity. Unknown provider starts are retained for manual reconciliation
rather than retried blindly. New admission limits never prevent finishing a job
that already owns a reserved slot. Provider calls can incur Arcade usage costs.
No live provider generation was used to verify this candidate.

## Local verification

`npm ci --ignore-scripts`, `npm test`, `npm run build`.
`npm run dev` serves http://127.0.0.1:4317 with a fake provider only; real keys are
ignored. The studio opens directly without a session or key.

40 scoped tests cover native Worker fetch invocation, safe diagnostics, generation lifecycle and SQLite restart, concurrency and
caps, request replay/ownership, failed/uncertain starts, lineage, public data
filtering, anonymous studio access, historical economics, and browser script
contracts. Original backend tests (86) and Shopify contract tests (28) also pass.
Browser QA confirms real saved images, basket co-pay reduction, direct studio access and
local mock generation. Live hosted access and live provider operation remain
unverified until approved deployment and subsequent checks.

## Source and deployment

The source helper owns this folder's isolated Git repository and pushes only its
source. `.env*`, local databases, node_modules, dist and artifacts are ignored.
`npm run build` emits `dist/server/index.js` and a hosting manifest. The official
Sites packager includes the versioned Drizzle migration. Save the pushed commit
and archive as a version without deployment. A separate user turn must explicitly
approve the exact production target before runtime configuration, deployment or
public access changes, per shared AGENTS.md / CLAUDE.md instructions.

## Marketing landing page — 2026-10-11

The home page continues the Creator Rewards film's visual direction. It includes
the saved Yosemite product preview, the English film with burned-in captions and
a transcript, an illustrative reward-contribution slider, customer and merchant
demo entry points, and prototype/pilot FAQs. Every demo link is same-origin; the
customer link reads the configured creator ID with a read-only API request.

The original Full HD film is retained in `../../marketing/creator-rewards-pilot/`.
The web copy is 1280×720, 59 seconds, H.264/AAC and approximately 1.9 MiB. It loads
only when played. Small binary assets are embedded by the existing Worker build;
the router implements GET/HEAD and single byte ranges for seeking. The full
Worker currently compresses to about 2.4 MiB; the build rejects gzip >3 MiB. Large
future media should move to a separately configured asset store, rather than
growing this embedded bundle.

Isolated landing preview (mock provider only, no real Arcade calls):

```sh
npm run build
PORT=4318 PREVIEW_DB=.sites-runtime/landing-preview.sqlite npm run dev
```

Browser verification: 1440px desktop, 390px and 320px mobile without horizontal
overflow; video observed playing at 11.9s with 59.008s duration, readyState 4 and
no media error; keyboard End on budget slider yields $140 store / $0 co-pay;
customer CTA opens `/shop?creator=alex`; studio opens directly without an access-key form.
No new provider generation, real checkout or production deployment was used.

## Open shared studio

All studio reads, campaign saves, collection archive/restore and explicit Arcade
generation actions are public. Campaign economics and activity are visible to
all visitors. The legacy access-key session endpoint is removed; an old cookie
cannot block access. New studio personalizations use a stable shared UUID for
idempotent retries. Existing saved jobs retain their original ownership records.
Customer quote/event responses retain their compact public shape; the studio
uses `/api/growth/studio-quote` for the full economic breakdown. Same-origin
write checks, input validation, rate limits and persistent generation caps remain.
Opening or reloading the studio never starts provider generation.
