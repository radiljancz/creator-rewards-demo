# Creator Rewards: živé Arcade + Shopify test do dvou hodin

Aktuální rozhodnutí zadavatele, 11. 10. 2026: živé Arcade a skutečná Shopify testovací objednávka, bez reálné platby, výroby a výplat. Testovací obchod zatím není založen. Tento dodatek mění předchozí demo-only backend handoff jen v níže uvedeném rozsahu; nerozšiřuje jej na plnou affiliate platformu.

## Jediná akceptační cesta

1. Operátor připraví jeden skutečný produkt přes Arcade, včetně provider ID a obrázku. Živá generace nemusí čekat na porotu; výsledek musí pocházet ze skutečného dokončeného jobu.
2. Fanoušek otevře funkční creator link v lokální aplikaci. Backend mapuje známý creator ID na jedinou kampaň. Zvolený skutečný produkt se zachová po celý průchod.
3. Fanoušek přepne dva maržové scénáře a vidí serverový výpočet. Pro Shopify testovací checkout je v tomto sprintu podporován pouze plně financovaný scénář. Menší scénář je náhled s doplatkem, nikoli hotové společné inkaso.
4. Backend vytvoří jedinečný `testRunId`, uloží očekávaný obchod, creator/campaign/product ID, Shopify variantu, množství, měnu a cenu běžné objednávky. Vrátí cart permalink na přednastavenou variantu s `attributes[creator_rewards_run]=<opaque id>`.
5. Fanoušek projde Shopify checkoutem s testovací bránou. Otevřít v nové kartě; původní aplikace zůstává na čekání. Není potřeba upravovat děkovací stránku.
6. Operátor v původní aplikaci spustí serverové ověření. Backend načte testovací objednávku přes Admin API, ověří odpovídající atribut a celý očekávaný scénář. Může periodicky opakovat čtení s timeoutem. Žádný veřejný endpoint nesmí zveřejnit seznam objednávek nebo osobní údaje.
7. Až při shodě vznikne právě jeden interní testovací záznam odměny a modelové provize. Výsledek ukáže skutečné Shopify order ID/name, `test: true`, stav zaplaceno v testovacím režimu, vybraný Arcade produkt a modelový finanční rozpad. Výroba neobjednána, skutečné peníze neinkasovány, provize nevyplacena.

Produkt Arcade je v tomto sprintu evidovaný jako navázaná odměna v naší aplikaci; není automaticky samostatnou položkou Shopify objednávky ani objednávkou výrobce. Toto říci i v prezentaci.

## První kontrolní bod: do 20 minut

Založit Shopify **dev store**, ideálně s generated test data. Ověřit přístup do administrace, funkční testovací bránu, publikovanou testovací variantu a možnost číst objednávky oprávněnou aplikací. Storefront je chráněný heslem; přístup v prezentačním prohlížeči připravit předem. Nepoužívat produkční Jackery obchod.

Nainstalovat aplikaci pouze pro tento vlastní testovací obchod, podle dostupného podporovaného toku v Dev Dashboard. Minimum oprávnění: čtení objednávek a podle potřeby produktů. Bez obecných multi-store OAuth/onboarding obrazovek. Tokeny a případný client secret zůstávají pouze na serveru; nic z toho neposílat do chatu.

První důkaz před dalším stylingem: jedna ručně dokončená testovací objednávka čitelná serverem. Pokud do 20 minut chybí účet, oprávnění nebo token, je dvouhodinový cíl v riziku. Připravené lokální demo zůstává záloha; nesmí se prohlásit za splněnou Shopify integraci.

## Rozdělení práce a časový rámec

Časy jsou rozpočet práce od zahájení sprintu, ne garantovaná délka externího zřízení účtů.

| Interval | Obchod / operátor | Backend programátor | Frontend |
|---|---|---|---|
| 0–20 min | Dev store, test gateway, publikovaná varianta, přístupy | Dokončit Arcade cestu a kontrakt, ověřit dostupný produkt | Připojit campaign/quote API, odstranit lokální finanční duplicitu |
| 20–50 min | Ověřit test checkout a sdělit variant ID bezpečně | TestRun, permalink, čtení a validace objednávky | Skutečný Arcade obrázek, creator link, čekání a chyby |
| 50–85 min | Jeden nový nákup v testovací bráně | Ověřit atribut, částky a jediné zapsání výsledku | Celý průchod od odkazu k ověřenému výsledku |
| 85–105 min | Opakování v prezentačním prohlížeči | Negativní testy a opakované ověření | Stav chyby, restart/návrat, mobil a ovládání |
| 105–120 min | Nácvik pitch, připravený produkt a test order | Jen opravy blokující průchod | Jen opravy blokující průchod |

## Kontrakt navíc pro programátora

Navržené názvy našich endpointů:

- `POST /api/shopify/test-runs` s `{campaignId, productId, scenarioId, requestId}`. Pouze velký scénář, skutečný Arcade produkt, známá varianta. Vrátí `runId`, `checkoutUrl`, `status: awaiting_test_order`.
- `POST /api/shopify/test-runs/:id/verify` jako chráněná operátorská akce. Čte Shopify, nepřijímá klientem tvrzené zaplacení. Výsledek `awaiting_test_order`, `mismatch` nebo `verified_test_order`.
- `GET /api/shopify/test-runs/:id` vrací minimum pro UI, bez adres/e-mailů/tokenů. Lokální session/run vazba; nepoužívat toto jako veřejnou autentizaci pro produkci.

Lze použít omezené načtení posledních objednávek založených po startu runu a přesnou kontrolu atributu; nelze spárovat pouze „poslední objednávku“. Při větším množství výsledků nesmí chybějící stránkování vytvořit falešný úspěch. Volitelně operátor zadá order ID, ale server i tak ověří jeho vazbu. Zvolený mechanismus musí projít jedním skutečným testem.

Ověřovat: cílový obchod, `test: true`, `displayFinancialStatus: PAID`, žádné storno/refund, očekávaná varianta a množství, měna, částka a žádná neočekávaná sleva. Celkovou cenu checkoutu odlišit od modelového příspěvku objednávky. Atribut je uživatelsky změnitelný, takže sám nestačí jako důkaz platnosti. Uložené očekávání je serverové. Jedinečnost podle shop + order ID i podle run ID; opakované ověření nesmí zdvojit odměnu.

Používat jediný lokální origin. Backend dnes očekává `prototype/index.html`; existující vizualizace je `prototype/creator-rewards.html`. Vlastníci se dohodnou na jedné cestě, neměnit souběžně stejné soubory. Webhooky a veřejný tunel nejsou podmínkou této lokální testovací integrace.

## Sjednotit peníze a zdroj dat

Aktuální backend již používá USD a minor units: před kampaní $460/$520, rozpočet $160/$220, creator $60, platforma $20, modelový produkt $140, příspěvek $80/$140, doplatek $60/$0, zbývá $300. Frontend zatím obsahuje původní CZK fixtures. Pro tento sprint navrhuji zachovat backendové USD a frontend plně odvozovat z API (`Intl.NumberFormat`, minor units / 100); nejde o převod původních Kč kurzem.

Stejnou měnu zvolit pro Shopify testovací obchod. Modelová cena $140 není potvrzený delivered cost Arcade a skutečná provider cena se zobrazuje odděleně. Nákupní ceny testovacích Shopify variant nastavit a ověřit zvlášť; contribution $520 není retail cena. Všechny marže, dotace a odměny zůstávají modelové i po skutečném Shopify testu.

## Co musí projít před označením hotovo

- Jeden doložený Arcade produkt a jeho zobrazení z backendu.
- Creator link zachová správnou kampaň a zvolený produkt.
- Serverové quote odpovídá stejné měně a scénáři jako UI.
- Nový testovací checkout přenese identifikátor až do objednávky.
- Backend objednávku ověří; UI ukáže její skutečné ID.
- Opakovaný verify nevytvoří druhou odměnu.
- Cizí/chybějící atribut, změněný košík nebo nezaplacená objednávka nevrátí úspěch.
- Restart nespustí znovu generování; existující produkt a run zůstanou uložené.

Nevyvíjet v tomto sprintu: automatické provize/výplaty, obecnou affiliate atribuci, Marketplace aplikaci, widget pro libovolný obchod, standalone checkout kolekce, skutečný doplatek, shipping quotes, výrobu, IOM a podporu více zemí. Tyto části nejsou potřebné k prokázání vybraného end-to-end testu.

## Ověřené podklady

- [Dev stores a požadované účty/oprávnění](https://shopify.dev/docs/apps/build/stores/development-stores)
- [Generated test data včetně testovací brány](https://shopify.dev/docs/apps/build/stores/generated-test-data)
- [Cart permalinks, attributes a omezení storefront hesla](https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks)
- [Admin GraphQL Order](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order)
