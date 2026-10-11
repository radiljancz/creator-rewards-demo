# Reconciliation původního Arcade designu

## Aktuální stav: vyřešeno 2026-10-11

Po uživatelově požadavku dokončit Arcade integraci byl podle čerstvě ověřeného idempotency kontraktu jednou zopakován přesně uložený `products/create` body se stejným requestId. Arcade vrátilo původní job `product_build_fde5b448fe05a24d62691363aeaa9cc7f90293cd04cb543b3a951d89b55026e5`, vytvořený v 20:11:32.307Z a dokončený v 20:11:35.768Z. `jobs/get` potvrdil succeeded a původní produkt `8a652ab0-a36d-4143-9563-8342f3d7a8bd`; `products/get` potvrdil pattern, kategorii a všechny selections. Nešlo o nový produkt.

Před opravou vznikla SQLite záloha `data/before-reconciliation-20261011.sqlite`. Transakční oprava jediného designu doplnila ověřený productJobId, productId, produkt a auditní reconciliation metadata; stav je nyní succeeded. Původní request/body zůstaly zachovány. Produkt nebyl přidán do veřejné kolekce, která dál obsahuje původní hlavní design `60ef47fd-30c8-40ed-b2cd-ac07fdde763a`. Nezbývá aktivní základní generace. Evidence: `/private/tmp/arcade-reconciled-evidence.json`.

Následující text zachycuje předchozí read-only checkpoint, nikoli aktuální blokaci.

Ověřeno 2026-10-11T20:48:48.744Z. Pouze čtení databáze a čtyři dokumentované čtecí operace Arcade; HTTP POST je u tohoto API i transport pro čtení. Nebyl proveden create, refine, replay, změna DB/env, restart ani objednávka/platba. Shopify demo tento krok neblokuje.

## Závěr

**Existující produkt je potvrzený, původní produktový job nelze současným read-only API jednoznačně dohledat. Rezervace unknown zůstává.**

Produkt odpovídá zdrojovému patternu, kategorii a variantám a byl vytvořen po zdrojovém patternu. V kompletní aktuálně viditelné inventory je jediný produkt s tímto patternem. Je to silná shoda produktu, ale nedokládá spojení jeho jobu s původním provider requestId. Nevyplňovat odhadnutý jobId ani nepřevzít pattern job jako product job.

## Konkrétní evidence

| Pole | Hodnota |
| --- | --- |
| Lokální design | 806f7fb1-e541-491e-ab56-0112322f5d78 |
| Aplikační requestId | bfe4e26b-cf0e-44a6-b0dc-ec661c5dd6b7 |
| Stav / fáze v SQLite | unknown / product |
| Původní produktový provider requestId | 806f7fb1-e541-491e-ab56-0112322f5d78:product |
| Pattern | cmv49cf5800l3lg10xigviq5b |
| Potvrzený pattern job | 67b0cf2b-3e1f-4b40-af80-9043284c2d6c; kind=pattern, status=succeeded, result obsahuje pouze patternId |
| Existující produkt | 8a652ab0-a36d-4143-9563-8342f3d7a8bd |
| Kategorie | e31ea74b-f8a6-42f1-b005-c67ea65faecf |
| Varianty | fabric=recycled_pet, size=18x18 |
| Vytvoření patternu | 2026-10-11T20:10:23.276Z |
| Vytvoření produktu | 2026-10-11T20:11:33.004Z |
| Cena produktu | $40.56 USD; bez potvrzené dopravy/daní |
| Produktové job ID v DB | Chybí |
| Shody v products/list | 1; nextCursor=null |

products/get ani products/list nevrátily jobId nebo requestId. patterns/get potvrdil původní pattern (sourcePatternId=null). jobs/get byl volán pouze s již uloženým pattern job ID a potvrdil jeho úspěch; nezískal produktové job ID.

Uložený původní body pro případ pozdějšího, samostatně schváleného reconciliation replay:

```json
{
  "requestId": "806f7fb1-e541-491e-ab56-0112322f5d78:product",
  "patternId": "cmv49cf5800l3lg10xigviq5b",
  "categoryId": "e31ea74b-f8a6-42f1-b005-c67ea65faecf",
  "selections": {
    "fabric": "recycled_pet",
    "size": "18x18"
  },
  "fit": {
    "mode": "fill"
  }
}
```

Zdrojová evidence: data/arcade-inventory.json (předchozí inventory), čerstvé odpovědi /private/tmp/arcade-reconciliation-readonly.json, čerstvý kontrakt /private/tmp/arcade-reconciliation-openapi.json. SQLite byla otevřena readOnly:true a po ověření stále obsahuje unknown bez productJobId. Do dokumentu nejsou vloženy provider klíče ani preview URL.

## Proč nelze dohledat job jen čtením

Aktuální [OpenAPI](https://docs.arcade.ai/openapi.json) dokumentuje jedinou job operaci jobs/get s povinným, neprůhledným jobId. Neobsahuje jobs/list, dohledání podle requestId ani reverse lookup z productId. products/get a products/list ve svém schématu i skutečných odpovědích neobsahují jobId/requestId. Product ID není dokumentovaná náhrada za jobId a nebylo tak použito.

Kontrakt products/list uvádí, že nový produkt se objeví po úspěchu jeho jobu. To spolu s products/get dokládá dostupný vytvořený produkt, nikoli identitu původního produktového jobu. [Jobs dokumentace](https://docs.arcade.ai/jobs) vysvětluje polling známého jobId, žádný další způsob dohledání nepřidává.

## Nejkratší bezpečný postup

1. Z původní HTTP odpovědi/trace, provider dashboardu nebo podpory získat doloženou vazbu provider requestId 806f7fb1-e541-491e-ab56-0112322f5d78:product → skutečné product jobId → productId 8a652ab0-a36d-4143-9563-8342f3d7a8bd. Podpora by měla potvrdit také účet, přesný původní body a konečný stav. Žádné kontaktování podpory nebylo provedeno.
2. Se získaným skutečným jobId provést pouze jobs/get: vyžadovat kind=product, status=succeeded a přesný result.productId. products/get musí stále potvrdit pattern, kategorii a varianty uvedené výše. Při konfliktu, běžícím jobu nebo chybě rezervaci neuvolnit.
3. Teprve s těmito důkazy a samostatným souhlasem k přesné lokální DB opravě lze transakčně doplnit pro tento design skutečné productJobId/productId a ověřený produkt, označit succeeded a vyčistit error. Nemazat řádek, requestId ani uložený body; nevymýšlet provenienci. Případné přidání dalšího creator produktu do veřejné kolekce musí být zahrnuto do odsouhlaseného rozsahu opravy. Takto se rezervace uvolní bez nového generování.

Pokud původní jobId nelze získat z existující evidence, existuje dokumentovaná alternativa v [idempotency kontraktu](https://docs.arcade.ai/idempotency): zopakovat products/create s **naprosto stejným výše uloženým body a requestId** pro získání původní odpovědi. To je POST na startovací endpoint, **není read-only** a nyní je zakázané. Vyžaduje přímý výslovný souhlas s jedním konkrétním replay a ověření použitelnosti původního idempotency záznamu; doba uchování není v dokumentaci uvedena. Bez jistoty vazby/idempotency záznamu nelze slíbit nulové riziko nové práce či kreditů. Na409 nebo jiný konflikt se zastavit; nevytvářet nové requestId a nepřepínat na nový create. Po získání skutečného jobu postupovat podle bodů2–3; souhlas s replay sám neznamená souhlas s DB zápisem.

**Chybí:** doložené původní product jobId a vazba na původní requestId. **Není nyní povoleno:** replay/startovací POST ani oprava DB. Pro tuto analýzu nebyly provedeny žádné z těchto kroků.
