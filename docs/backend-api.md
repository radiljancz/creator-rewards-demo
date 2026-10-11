# Backend API pro frontend

Base: `http://127.0.0.1:3000`, preferovaný stejný origin jako frontend. `npm start` spustí mock režim a skutečné lokální SQLite úložiště. Provider se v mock režimu nevolá. `/` obslouží `prototype/creator-rewards.html`, existuje-li, jinak vrátí přehled služby. Asset ilustrace je `/assets/coastal-pillow.svg`.

## Model v USD

API vrací integer centy, UI je formátuje `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(cents / 100)`. Jde o nový USD model, nikoli FX převod ani skutečnou nabídku Arcade.

| Položka v dolarech | small | large |
| --- | ---: | ---: |
| Příspěvek běžné objednávky po jejích nákladech, před kampaní | 460 | 520 |
| Budget kampaně | 160 | 220 |
| Creator commission | 60 | 60 |
| Platform fee | 20 | 20 |
| Modelový náklad creator produktu | 140 | 140 |
| Merchant subsidy | 80 | 140 |
| Fan copay | 60 | 0 |
| Merchant contribution after | 300 | 300 |

Menší: `$460 − $60 − $20 − $80 = $300`; produkt pokrývá `$80 + $60 = $140`. Větší: `$520 − $60 − $20 − $140 = $300`; produkt plně kryje obchod. Příspěvek objednávky není cena košíku a není doloženou marží skutečného obchodu.

## Veřejný průchod

`GET /api/demo/campaign` → seed `id`, `creator`, `merchant`, `collection.products`, `scenarios`, `currency:"USD"`, `demo:true`. Ilustrační produkt ID je `coastal-pillow`. Nové dokončené návrhy se přidávají do stejné kolekce. Fixture příklady jsou v `docs/api-examples/`.

```sh
curl http://127.0.0.1:3000/api/demo/campaign
curl http://127.0.0.1:3000/api/designs/categories
curl -X POST http://127.0.0.1:3000/api/demo/quote \
  -H 'Content-Type: application/json' \
  -d '{"campaignId":"creator-rewards-demo","productId":"coastal-pillow","scenarioId":"small"}'
```

Quote vybírá částky na serveru. Neznámá ID → 404. Další fields, včetně ceny od klienta → 400. Vrací `pricingSource:"demo_fixture"`, `demo:true` a všechny částky.

```json
{
  "campaignId": "creator-rewards-demo",
  "productId": "coastal-pillow",
  "scenarioId": "small",
  "orderContributionBefore": 46000,
  "campaignBudget": 16000,
  "creatorCommission": 6000,
  "platformFee": 2000,
  "productCost": 14000,
  "merchantSubsidy": 8000,
  "fanCopay": 6000,
  "merchantContributionAfter": 30000,
  "currency": "USD",
  "pricingSource": "demo_fixture",
  "demo": true
}
```

```sh
curl -X POST http://127.0.0.1:3000/api/demo/complete \
  -H 'Content-Type: application/json' \
  -d '{"campaignId":"creator-rewards-demo","productId":"coastal-pillow","scenarioId":"large","requestId":"presentation-1"}'
```

Complete znovu počítá scénář. Vrací quote, stabilní `completionId`, `completedAt`, `status:"simulated"`, `paymentOccurred:false`, `orderPlaced:false`, `payoutsOccurred:false`. Stejný requestId se stejnými ID vrací stejný výsledek i po restartu; změněný payload → 409. Reset je pouze frontendová navigace a lokální state: nevolejte generaci a nemažte databázi.

## Operátorský průchod

`GET /api/designs/categories` vrací jednu podporovanou kategorii, kompletní volby, `mode` a `generationAvailable`. Mock kategorie `mock-textile` je pouze místní fixture. Live ID se vybírá z opravdového `categories/list`; ověřené 2026-10-11: `e31ea74b-f8a6-42f1-b005-c67ea65faecf`, Outdoor Decorative Pillows. Při změně API vždy načtěte aktuální katalog.

`POST /api/designs` vyžaduje `Authorization: Bearer <server operator token>` a JSON:

```json
{"prompt":"Coastal trails, an original outdoor textile motif, no logo","categoryId":"mock-textile","requestId":"creator-design-1"}
```

Vrací `202` a `{designId,status:"queued",stage:"pattern",mode,error:null,providerJobId:null,product:null}`. Live používá skutečné category ID z katalogu. V autorizovaném operátorském UI použijte serverovou vrstvu; token nikdy nezabalte do veřejného bundle. Zde je připravený chráněný endpoint pro lokální operátorské volání, nikoli veřejná admin session.

`GET /api/designs/:id` pouze čte uložený stav. Nespouští nový job a neobnovuje obrázkové URL. Stavy: `queued`, `starting`, `running`, `succeeded`, `failed`, `timed_out`, `unknown`, `awaiting_product`, `awaiting_resume`. Stage je `pattern` nebo `product`. Succeeded obsahuje produkt s původem; mock má provider ID i generatedAt null.

Operátorské doplňky (body `{}`, stejná authorization):

- `POST /api/designs/:id/resume`: po timeoutu znovu polluje uložený job. Pokud pattern po restartu skončil, explicitně pokračuje jedním product jobem. Unknown start odmítá 409.
- `POST /api/designs/:id/refresh`: obnoví hotový live náhled pouze přes `products/get`. Nevytváří nový job. Při chybě zůstává uložený produkt zachovaný.

Po restartu se automaticky obnovuje pouze polling existujícího live jobu. Pattern, který skončí až po restartu, se zastaví na `awaiting_product`; pokračuje explicitní resume. Přerušený start bez uloženého job ID se označí `unknown` a blokuje další návrh. Nelze jej bezpečně resetovat: vyžaduje ruční ověření původního provider requestId a stejného uloženého body. Automatický retry ani nový requestId v takové situaci nevznikne.

Nejvýše jeden nerozřešený návrh. Timeout/unknown drží rezervaci; failed/succeeded ji uvolní. Počet návrhů v režimu je trvalý, default 3, lze nastavit 0 pro vypnutí. Opakování requestId nezvyšuje počet; jiný payload vrací 409. Selhání live nikdy nepřejde na údajně skutečný mock produkt.

Provider `unitPrice` se uchovává samostatně jako `{amount:"48.00",currency:"USD"}` nebo null; **tento provider decimal string je výjimka z integer centů našeho modelu**. Obsahuje pouze cenu z API, ne doložené daně/dopravu. Jinou provider měnu nepřevádíme automaticky. UI nepoužívá tuto cenu jako vstup do quote.

## Ochrana a skutečnost

Všechny požadavky validují přesný loopback Host/port a přítomný Origin; cross-origin → 403, nesprávný content type POST → 415, body >16 KiB → 413. Žádné obecné stahování URL. Služba odmítne bind `0.0.0.0`; shared hosting potřebuje samostatnou serverovou session a není součástí tohoto lokálního dema. Key zůstává v `.env.local`, data a signed URL v ignorovaném `data/`.

**Skutečné nyní:** lokální HTTP služba, SQLite persistence, read-only autorizované ověření Arcade kategorie a voleb. **Simulované:** obchod, creator, routing, oba USD výpočty, kompletní nákup, provize a lokální ilustrace. **Dosud nedoložené:** vygenerovaný Arcade produkt s job/product/pattern ID a náhledem. Read-only inventory 2026-10-11 vrátilo prázdný seznam produktů; během přípravy žádný nový provider job neběžel.

Adapter byl připraven podle aktuálního [OpenAPI](https://docs.arcade.ai/openapi.json), [quickstartu](https://docs.arcade.ai/quickstart), [jobs](https://docs.arcade.ai/jobs) a [idempotency](https://docs.arcade.ai/idempotency). Provider používá POST i pro čtení. Start má dva samostatné requestId a jejich přesná body i job ID se ukládají. Připnutý veřejný kontrakt je v `docs/arcade-contract.md`.

Současný HTML prototyp používá shodné USD fixture, ale zatím nevolá backend fetch. Jeho existující PNG náhledy vznikly před aktualizací měny.
