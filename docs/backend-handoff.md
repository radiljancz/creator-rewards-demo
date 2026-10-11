# Creator Rewards: zadání backendu pro hackathon

Priorita: podpořit dvouminutové prezentační demo. Postavte jednu malou službu pro skutečné návrhy z Arcade a modelovou ekonomiku creator kampaně. Nejde o produkční affiliate platformu. Tento dokument a prezentační zadání mají přednost před starším `creator-rewards-technical-reference.md`.

## Příběh produktu

Creator vytvoří kolekci přes Arcade. Fanoušek přijde přes jeho odkaz, vybere si výrobek a při nákupu u partnerského obchodu získá příspěvek nebo plné pokrytí jeho ceny. Creator dostane modelovou provizi, obchodník zachová stanovený příspěvek objednávky. Výrobek nemá povinné logo značky. Demo používá jeden obchod, jednoho fiktivního creatora a dvě varianty košíku.

## Pořadí práce

1. Ihned vraťte seed kampaně a oba modelové výpočty přes níže navržené API. Frontend tak může vznikat souběžně.
2. Přidejte Arcade adapter a jednu skutečnou cestu: zadání motivu → pattern → product → náhled produktu. Nejdříve ověřte přesná schémata v aktuálních docs. Použijte již oprávněně uložený serverový klíč; nevypisujte jej.
3. Uložte hotový výsledek včetně původu tak, aby šel znovu ukázat bez nové generace. Připravte jeden předgenerovaný produkt jako zálohu pro prezentaci.
4. Přidejte simulované dokončení a reset pouze demo průchodu.

Použijte framework, který již máte rozběhnutý. Pokud žádný není, stačí malá TypeScript/Node služba a SQLite. Žádné fronty, mikroservisy ani affiliate framework. Úložiště musí uchovat provider job ID i po restartu, aby obnovení průchodu nespustilo novou generaci.

## Navržený kontrakt našeho API

Toto jsou naše endpointy, nikoli názvy endpointů Arcade. Preferujte stejný origin jako frontend. Všechny peníze jsou integer v centech a obsahují `currency: "USD"`.

| Endpoint | Vstup a výstup |
|---|---|
| `GET /api/demo/campaign` | Seed: `id`, `creator`, `merchant`, `collection`, `scenarios`, `demo: true`. |
| `POST /api/designs` | Oprávněný operátor posílá `prompt`, podporované `categoryId` a `requestId`. Vrací `202`, lokální `designId` a `status`. |
| `GET /api/designs/:id` | Vrací stav, stage `pattern/product`, případnou chybu a hotový produkt. Čtení nikdy nespouští další generaci. |
| `POST /api/demo/quote` | `{campaignId, productId, scenarioId}`; ekonomické vstupy vybírá server ze seedu. Vrací níže uvedený rozpad a `pricingSource: "demo_fixture"`. |
| `POST /api/demo/complete` | `{campaignId, productId, scenarioId, requestId}`; znovu spočítá scénář, vrátí modelový výsledek s `status: "simulated"`. Opakování stejného requestu vrací stejný výsledek. |

`scenarioId` je `small` nebo `large`. Neznámé ID odmítněte. `complete` nic neobjednává a nevyplácí. Reset vrací frontend na první obrazovku, nemaže skutečné návrhy a neopakuje provider operace.

Produkt v kolekci: `id`, `name`, `imageUrl`, `imageSource` (`arcade` nebo `illustration`), `providerProductId`, `providerPatternId`, `providerJobId`, `generatedAt`, volitelná `providerUnitPrice` s vlastní měnou. V mock režimu jsou provider ID `null`; nikdy nevyrábějte falešnou provenienci. Ilustrační produkt lze použít pro modelový quote.

## Arcade adapter

Pracujte podle [quickstartu](https://docs.arcade.ai/quickstart), [jobs](https://docs.arcade.ai/jobs), [idempotency](https://docs.arcade.ai/idempotency) a [agent skills](https://docs.arcade.ai/agents). Cíl API je `https://platform.arcade.ai/v1`; konkrétní parametry převezměte z dokumentace, ne z tohoto briefu.

Kategorie a volby produktu načtěte z API. Pro první demo vyberte jedinou podporovanou textilní kategorii, ideálně outdoorový povlak. Nevymýšlejte podporu triček či hrnků. Nejprve vzniká pattern job, poté product job. Polling musí mít timeout a umožnit pozdější navázání na existující job. Neúspěšný nebo nejasný start nereplikujte slepě. Pro retry využijte provider idempotency, pokud ji daná operace podle docs podporuje; lokálně deduplikujte `requestId`.

Obrázkové URL mohou expirovat: obnovujte je přes retrieve odpovídajícího provider objektu. Cena produktu není automaticky cena včetně dopravy a daní. Oddělte skutečnou provider cenu a její měnu od modelového USD výpočtu. V demu nepřevádějte jiné měny do USD bez explicitního modelového kurzu.

Režimy: `ARCADE_MODE=mock` a `live`. Mock vrací označenou ilustraci; live vrací doložený provider výsledek. Selhání live nesmí potichu změnit původ na údajně skutečný Arcade návrh. Generování pouze explicitním operátorským tlačítkem, s jedním souběžným jobem a nastavitelným limitem počtu; žádné generování při refreshi nebo resetu.

## Shodná ekonomika pro frontend i backend

Tabulka je v USD, API vrací částky × 100. Na přání zadavatele je celé demo v USD; částky jsou nový dolarový fixture, nikoli převod měnovým kurzem. Jde o interní model, nikoli závaznou maloobchodní nabídku či ověřené doručené ceny Arcade.

| Pole | small | large |
|---|---:|---:|
| `orderContributionBefore` | 460 | 520 |
| `campaignBudget` | 160 | 220 |
| `creatorCommission` | 60 | 60 |
| `platformFee` | 20 | 20 |
| `productCost` | 140 | 140 |
| `merchantSubsidy` | 80 | 140 |
| `fanCopay` | 60 | 0 |
| `merchantContributionAfter` | 300 | 300 |

Invarianty: `commission + fee + subsidy <= campaignBudget`; `subsidy + copay = productCost`; `after = before - commission - fee - subsidy`. Vstupy nesmí být záporné ani NaN. Vyšší košík zde znamená jiný připravený maržový scénář; obecně vyšší cena nákupu nezaručuje vyšší benefit. Creator provize je domluvený model, ne automaticky snížená existující provize.

## Minimum ochrany a ověření

Klíč zůstává serverově mimo git a logy. Operátorské generování je oddělené od veřejného čtení; lokální demo může běžet jen na loopbacku, při sdíleném hostingu vyžaduje chráněnou serverovou session a kontrolu originu. Secret nepatří do klientského JavaScriptu. Žádné libovolné serverové stahování URL obchodu či obrázků.

Ověřte obě kalkulace, neplatné ID, opakovaný `requestId`, failed/timeout job a obnovu po restartu bez další generace. Pro skutečnou integraci doložte alespoň jeden provider product ID a jeho náhled. Předejte příklady request/response, `.env.example` bez klíče, příkaz spuštění a přehled, co je skutečné a co simulované.

## Teď nestavět

Shopify OAuth/plugin, IOM, skutečný checkout, inkaso doplatku, Arcade checkout nebo objednávku výroby, refundy, výplaty, skutečné affiliate sledování, registrace více obchodů, účetnictví ani dashboard analytiky. Creatorův odkaz je demo routing, žádný důkaz skutečné atribuce. Samostatný prodej kolekce stačí v UI označit jako budoucí možnost.

Hotovo znamená: frontend načte kampaň, otevře skutečný předgenerovaný Arcade výsledek, přepne dva správné výpočty a dokončí označenou simulaci. Backend pro demo není důkaz připravenosti k produkčnímu prodeji.
