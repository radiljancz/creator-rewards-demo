# Creator Rewards tracking demo implementation plan

Approved scope: merchant URL + editable products/economics + creator link + embeddable script + actual visitor events + Arcade product selection. Supersedes Shopify test sprint. No Shopify, payments, production mutations or manufacturing.

Architecture: retain existing Node/SQLite/Arcade backend. Add isolated growth handler using the same SQLite connection. Serve new merchant UI and demo shop on the existing loopback service. Tracking script can be embedded; current delivery is local, so public installation requires an HTTPS host later. Never claim external installation from a typed URL or demo-shop event.

## Tasks and ownership
- Backend worker: backend/growth.mjs and backend/test/growth.test.mjs. Campaign config, authoritative budget calculator, bounded idempotent events, dashboard, browser operator session, protected generation bridge. No edits to existing server/main/store.
- Widget worker: prototype/rewards.js and prototype/shop.html. Real script referral detection/event POST, supported cart callback, product widget and live recompute. No edits to other files.
- Parent: prototype/index.html, server/main integration, docs, visual/functional verification and OpenDesign artifact.

## Contract
`createGrowth({store,products,designs,mode})` returns async `handle(req,res,{path,baseOrigin})` boolean handled. Parent mounts after Host validation but before global Origin validation; growth handler MUST independently enforce origins per route. Same-origin admin mutation requires exact Origin and HttpOnly SameSite=Strict operator-session cookie acquired by same-origin POST /api/growth/session. Never expose provider/operator tokens.

Merchant config GET/PUT /api/growth/config (PUT operator session): {id:'main',shopName,shopUrl,currency:'USD',creator:{id:'alex',name},products:[{id,name,price,cost}],economics:{minRetained,campaignCap,creatorCommission,platformFee,rewardCost}}. Money integer cents. Defaults products weekend price99900 cost53900, adventure price129900 cost77900; minRetained30000 cap22000 commission6000 fee2000 rewardCost14000. URL HTTPS public hostname; don't fetch. Default https://jackery.cz. Public payload MUST OMIT product costs and merchant economics, except reward cost as labeled model.

GET /api/growth/public?campaign=main → {id,shopName,shopUrl,currency,creator,products:[{id,name,price}],rewards:products(),rewardCost,revision}.
POST /api/growth/quote {campaignId:'main',items:[{productId,quantity}],rewardId} → {eligible,reason?,basketTotal,orderContributionBefore,campaignBudget,creatorCommission,platformFee,productCost,merchantSubsidy,fanCopay,merchantContributionAfter,currency,pricingSource:'merchant_model'} (public response omit orderContributionBefore/merchantContributionAfter/campaignBudget/commission/platformFee if external origin; dashboard can calculate via same-origin). A=max(0,min(cap,M-minRetained)); ineligible if M<minRetained or commission+fee>A. For ineligible: subsidy0/copayrewardCost/commission0/fee0/retainedM. Never grant partial commission if ineligible. Products validate ids, quantities integer1..10, list max10 no duplicates, money safe integer bound1e9.
POST /api/growth/events {campaignId,creatorId,sessionId,eventId,type:'visit'|'reward_selected'|'basket_updated'|'checkout_simulated',rewardId?,items?}. Server validate exact allowed types known ids, derive quote from own inputs for basket/checkout, dedupe eventId and reject mismatched reuse. Record request origin; demo-origin events cannot indicate external shop installed. No checkout event implies actual payment. Event history max200; cap/rate body and sessions. GET /api/growth/dashboard same-origin admin read {config,events,stats:{visits,selections,simulatedCheckouts},demoConnected,shopConnected}. Mark browser observations, not verified human attribution.
POST /api/growth/designs (session) → designs.create and GET /api/designs/:id existing poll. POST /api/growth/designs/:id/resume|refresh same session. No automatic provider calls when opening/resetting screen. mode passed by parent.

Public routes permit same origin and configured shop origin only, exact Origin validation; CORS explicit allow origin, Vary Origin, no credentials for third-party. OPTIONS supported. Other routes same-origin only, GET no CORS. Static script /rewards.js is public JS; demo shop /shop local. Widget reads data-campaign main and currentScript.src base, sends noncredentialed public requests. Session-scoped referral creator allowlist; URL creator unknown ignores/errors. No full URLs, emails, fingerprinting captured. Widget API window.CreatorRewards.setBasket(items), open(), simulate(). Shop uses backend public products. All external strings rendered textContent.

## Verification
- [ ] Backend failing tests: margin floor/cap, negative margin, invalid quantity/money/URL, replay dedupe, origin isolation, admin auth, no false paid events.
- [ ] Existing backend regression suite passes.
- [ ] Merchant config persists and public config hides costs.
- [ ] Real browser script creates visit and selection; dashboard sees events.
- [ ] Changing basket updates copay60→0 USD; minRetained edit updates benefit.
- [ ] Invalid referral/price tampering doesn't manufacture commission or revenue.
- [ ] Mobile/desktop screenshots; no JS error; no secret leaks.
- [ ] OpenDesign stores final UI reference; docs say local vs externally installed and real Arcade evidence.

Ruling: User approved the complete in-chat design and asked for a two-hour functioning demo; proceed with the existing shared workspace and isolated file ownership, no new approval cycle or blanket git commit of another programmer's untracked work.
