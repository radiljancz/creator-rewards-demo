# Creator Rewards demo backend implementation plan

**Goal:** Připravit lokální backend podle `docs/backend-handoff.md`, aby frontend mohl ihned používat oba scénáře a trvale uložené návrhy.

**Spec:** `docs/backend-handoff.md`; aktuální prezentační zadání má přednost před technickou referencí.

**Architecture:** Jedna Node služba, SQLite přes vestavěné `node:sqlite`, žádné externí runtime závislosti. Výchozí režim mock, pouze loopback. Arcade adapter oddělený od modelové USD ekonomiky. JavaScript ESM lze přímo spustit bez kompilátoru; veřejný kontrakt dodává JSON a příklady.

**Constraints:** Žádný deploy, objednávka, checkout, payout ani automatická generace při GET/resetu. Key pouze serverově. `requestId` deduplikuje lokálně i po restartu; nejasný start se automaticky neopakuje. Nejvýše jeden aktivní návrh a trvalý limit návrhů. Mock provenience je vždy null. Shared hosting není součástí přípravy: služba odmítne jiný bind než loopback.

## Task 1 — Kampaň a ekonomika

- [x] Přidat test s ručně odvozenými částkami small/large, neplatnými ID a vstupy.
- [x] Ověřit RED, implementovat `backend/campaign.mjs`, znovu spustit test.
- [x] Seed obsahuje jeden modelový obchod, creatora a lokální označenou ilustraci. Quote přijímá pouze ID, server vybírá ekonomiku.

```js
assert.equal(quote({campaignId:'creator-rewards-demo', productId:'coastal-pillow', scenarioId:'small'}).fanCopay, 6000);
assert.equal(quote({campaignId:'creator-rewards-demo', productId:'coastal-pillow', scenarioId:'large'}).merchantContributionAfter, 30000);
```

## Task 2 — Persistované návrhy a adapter

- [x] Ověřit aktuální public OpenAPI, kategorie/volby read-only; žádný nový provider job při přípravě.
- [x] Přidat testy requestId conflict/replay, failed job, timeout, restart při aktivním jobu, nejasný start, souběh a limit.
- [x] Ověřit RED, implementovat `backend/store.mjs`, `backend/arcade.mjs`, `backend/designs.mjs`.
- [x] Persistovat stage, provider job IDs, request fingerprint a klíče před POST. Polling má deadline; po timeoutu lze explicitně navázat pouze na existující job. Stav bez doloženého job ID se označí unknown a neodesílá znovu.
- [x] `GET` pouze čte. Resume je operátorský POST; při restartu se obnoví pouze polling existujících jobů. Hotový produkt ukládá původ a oddělenou provider cenu.

## Task 3 — HTTP kontrakt a simulace

- [x] Přidat HTTP testy seed/quote/complete, idempotentního complete po restartu, malformed JSON, extra fields, origin/Host protection, denied operator request.
- [x] Ověřit RED, implementovat `backend/server.mjs`, config a entrypoint.
- [x] Mutující POST vyžaduje JSON, přesný Host a shodný Origin, je-li přítomen. Generace/resume vyžaduje serverový operator token. Klient nesmí dostat tento token v seed/JS.
- [x] Reset zůstává frontendová navigace; data a provider joby nemaže.

## Task 4 — Předání a ověření

- [x] `npm test` a lokální HTTP smoke.
- [x] README, `.env.example`, request/response příklady, API snapshot s ověřeným datem, inventář skutečné vs. simulované.
- [x] Read-only ověřit, zda účet již obsahuje vhodný produkt. Zálohu lze importovat jen s ověřenou proveniencí. Pokud není dostupný, reportovat chybějící skutečný výsledek a připravenou explicitní operátorskou cestu.

## Review focus

1. Crash mezi provider POST a uložením response: unknown, žádný nový POST při restartu.
2. Stejný requestId s jiným payloadem: 409 i po restartu.
3. Expirující náhled: explicitní read-only refresh produktu; nesmí začít job.
4. DNS rebinding/cross-origin požadavek: validace Host/Origin před POST.
5. Complete nesmí přijmout částky od klienta, neplatná ID, ani vytvořit transakci.

## Progress

- Příprava: Node 26.8.1 a SQLite 3.53.4 dostupné. Repo nemá žádný commit; původní dokumenty jsou untracked a zůstávají zachované.

- Steering uživatele: celé demo je USD; model je $460/$520 před kampaní, $160/$220 budget, $60 commission, $20 fee, $140 product, $80/$140 subsidy, $60/$0 copay a $300 after. Nejde o FX převod.

- Ověření: 25/25 testů, syntaktická kontrola všech backend modulů, běžící localhost mock API s oběma quote výsledky. V prohlížeči ověřeny USD small/large a označená simulace.
- Review: opraveny invalid polling reservation, deadline před novým stage POST, jobId/kind provenance a atomické zabránění duplicitnímu stage startu. Regresní testy nejprve RED, poté GREEN.
- Skutečné připojení: read-only categories/list + categories/get + products/list; Outdoor Decorative Pillows, fabric=recycled_pet, size=18x18; products=[] a nextCursor=null. Žádný nový provider job.
- Limity: skutečný Arcade produkt zatím chybí; prototyp má stejné USD fixture, ale zatím nepoužívá API fetch. Žádný commit, push, merge nebo deploy. Existující uživatelské dokumenty a PNG zachovány, upraveny pouze aktuální měnové fixture.
