# Zadání platformy pro creator kolekce a odměny v Shopify

Pracovní název: Creator Rewards. Datum: 11. října 2026. Zadavatel: ILICO a Jackery. Revize po paralelním review zadání. Implementace dosud nezačala; nejprve je nutné ověřit níže uvedené integrační předpoklady. Jde o produktové a technické zadání, nikoli o rozpis změn existující aplikace.

Vytvořte hackathonové MVP Shopify aplikace, která propojí existující spolupráce obchodníka s influencery s jejich vlastními produkty vytvořenými přes Arcade. Creator přivede zákazníka svým odkazem. Zákazník si může vybrat produkt z creatorovy kolekce a podle ekonomiky svého nákupu získat příspěvek na tento produkt nebo celý produkt zdarma. Samostatný prodej kolekce zůstává součástí cílového produktu a navazuje po hackathonovém MVP.

Obchodník nastavuje rozpočet kampaně. Provize creatorovi, příspěvek zákazníkovi a poplatek platformě se společně musí vejít do tohoto rozpočtu a zachovat požadovaný příspěvek objednávky na zisk. Creator s rozdělením odměny předem souhlasí.

## Problém a hypotéza

Existující spolupráce s influencery přivádějí návštěvníky na e-shop. Chceme ověřit, zda vlastní produkt oblíbeného creatora může být důvodem k nákupu a zda lze tento benefit financovat z rozpočtu spolupráce. Pro creatora vzniká příležitost vydělávat na své kolekci a na přivedených objednávkách. Zákazník získává výrobek, který si sám vybral a chce používat.

Hypotéza pro pilot: nabídka creatorova výrobku zvýší příspěvek na zisk na přivedeného návštěvníka proti dosavadní affiliate nabídce. Současně musí spolupráce zůstat zajímavá pro creatora. Vyšší počet objednávek ani vyšší hodnota košíku samy o sobě úspěch neprokazují.

Produkty mají vlastní estetickou hodnotu. Povinné logo Jackery, reklamní slogan a firemní barvy nejsou součástí zadání. Creator může použít vlastní ilustrace, fotografie nebo motivy, k nimž má práva.

Shopify Collabs již nabízí affiliate odkazy, sledování prodejů a odměňování creatorů. Arcade Studio již nabízí tvorbu produktů a Shopify integraci. Přínosem projektu je creatorova kolekce v nákupní cestě a výpočet, za jakých podmínek ji obchodník dokáže zákazníkovi financovat. [Shopify Collabs](https://help.shopify.com/en/manual/promoting-marketing/collabs), [Arcade Studio](https://studio.arcade.ai/).

## Rozsah hackathonového MVP

Povinné P0 je jedna průchozí cesta: přednastavený Shopify vývojový obchod, jeden creator, jedna kampaň, jeden skutečný produkt Arcade, dva ukázkové košíky a jedna ověřená Shopify testovací objednávka. Zákazník uvidí creatorův produkt a změnu příspěvku podle košíku; obchodník uvidí ekonomiku a právě jeden evidovaný nárok.

Integrovaný scénář P0 používá plné financování produktu obchodníkem, tedy `D_net = 0`. Výpočet příspěvku s doplatkem zůstává v rozhraní, ale `D_net > 0` je pouze náhled s označením „Platba doplatku zatím není dostupná“. Nevede k inkasu, objednání produktu ani k tvrzení, že je financování kompletní. Tím se zachovává cílový obchodní model bez předstírání neexistující společné platební integrace.

P0 obsahuje jednoduchou autentizovanou pracovní plochu obchodníka pro generování, schválení a výsledek objednávky; customer landing a nabídku u košíku. Creator je přednastavený a jeho souhlas je evidovaný jako skutečný nebo výslovně modelový. Samoobslužné pozvánky, creatorův samostatný účet/dashboard, obecný onboarding dalších obchodů a editace všech parametrů kampaně jsou P1. Ověření přístupů, podpisů událostí, rezervací a finančních invariantů potřebné pro P0 se neodkládá.

Výroba, úhrada Arcade a výplata provizí nejsou součástí P0. Pokud se nepodaří připojit Shopify, lze ukázat označený prototyp, ale ten nesplňuje kritéria integrovaného MVP.

Před tvorbou obrazovek uzavřete vstupní ověření:

1. Určete vývojový obchod, aplikaci a oprávněný účet. Ověřte instalaci, čtení katalogu, testovací bránu a veřejný HTTPS endpoint pro webhooky.
2. Použijte existující oprávněné připojení Arcade. Potvrďte aktuální kategorii `print`, vyrobitelnou variantu a jeden skutečný produkt s ID, obrázkem, měnou a vyplněnou cenou `unitPrice`. Generování je skutečná operace poskytovatele; přístupový klíč není důkaz bezplatnosti.
3. Vyberte jeden vizuálně přesvědčivý produkt pro publikum creatora. Outdoorový povlak je kandidát, ne závazná volba. Ověřte, co balení obsahuje, a nepředpokládejte výplň ani libovolné příslušenství pro Jackery.
4. U každé složky dopravy, nákladů a dostupnosti země zaznamenejte zdroj, datum a stav ověřeno/model. `unitPrice` není celková doručená cena. Bez doložené dopravy smí demo pracovat jen s označeným modelem, ne se závazným slibem produktu zdarma.
5. Prokažte přenos opaque identifikátoru z cart attribute do jedné testovací objednávky a následné serverové ověření zaplacení. Teprve poté rozvíjejte vzhled a další obrazovky.

Přehled výsledků ověření je součástí předání; neúspěch žádného kroku nenahrazujte tvrzením o funkční integraci.

## Uživatelé a odpovědnosti

| Uživatel | Co dělá | Co potřebuje vidět |
| --- | --- | --- |
| Obchodník | Připojí obchod, pozve creatora, schválí kolekci a nastaví rozpočet | Náklady kampaně, přivedené objednávky, příspěvek na zisk |
| Creator | Vytvoří kolekci, přijme podmínky a sdílí odkaz | Podobu produktů, pravidla své odměny, evidovaný výdělek |
| Zákazník | Přijde přes odkaz a vybere si creatorův produkt | Celkovou cenu, příspěvek obchodu, případný doplatek a způsob doručení |

## Hlavní uživatelský scénář

1. Obchodník autorizovaně připojí vývojový obchod. P0 může použít předem dokončenou instalaci; samotná URL přístup neposkytuje.
2. V přednastavené kampani určí kvalifikované varianty zboží, náklady, provizi, minimální příspěvek na zisk a limit kampaně. Creatorovy podmínky mají neměnnou verzi a evidovaný souhlas. V P0 vytváří kolekci oprávněný operátor pro daného creatora.
3. Přes Arcade vznikne jeden produkt, který operátor schválí do kolekce. Generování může proběhnout před prezentací; dokladem je skutečný výsledek jobu a produktu.
4. Fanoušek otevře creatorův odkaz na landing page v obchodě, zvolí návrh a běžné zboží. Nabídka přepočítá příspěvek. Vyšší cena košíku nemusí znamenat větší benefit.
5. U plně hrazené nabídky stiskne vlastní CTA „Rezervovat produkt a přejít k testovací platbě“. Server ověří kampaň, vytvoří verzi kalkulace a atomicky rezervuje celý výdaj `C + F + S`. Storefront uloží opaque identifikátor rezervace do košíku; až po úspěšném zápisu pokračuje do testovacího checkoutu. Při selhání naváže retry na stejnou rezervaci.
6. Jiné checkout cesty zůstávají běžným nákupem bez automatického nároku. V demo tématu odstraňte z kampaně zrychlená tlačítka, která tuto cestu obcházejí. Rozšíření tématu samo neumí vynutit chování všech checkoutů.
7. Server po ověřené události zaplacení načte skutečnou Shopify objednávku a porovná ji s rezervací: obchod, kvalifikované varianty a množství, slevy, měnu, částky i zemi. Změněná nebo chybějící vazba vede k ručnímu posouzení, nikoli automatickému benefitu.
8. Jen při shodě vznikne právě jeden testovací nárok a čekající interní provize. Výsledek zní: „Nárok je evidovaný a čeká na ruční vyřízení. Creatorův produkt zatím nebyl zaplacen ani objednán u výrobce.“
9. Obchodník vidí náklady, rezervovaný/čerpaný rozpočet a stav. Výroba ani výplata se nespouštějí. Pokud jsou náklady modelové, také nárok zůstává modelový a nesmí být použit pro skutečné plnění.

## Dva obchodní režimy

Hlavní režim je příspěvek na creatorův produkt při kvalifikovaném nákupu. Creator dostává dohodnutou affiliate provizi; v MVP se současně nepřidává další odměna za darovaný produkt. Případné snížení běžné provize vyžaduje jeho souhlas.

Před zveřejněním uložte `terms_version`, sazbu a základ provize, kvalifikované položky, atribuční okno, limit a konec kampaně, pravidla storen a okamžik vzniku/potvrzení provize. Souhlas obsahuje identitu a čas; změna podmínek vytváří novou verzi a zhoršení podmínek vyžaduje nový souhlas. Staré objednávky používají původní verzi. Demo souhlas nesmí být vydáván za skutečnou smlouvu s creatorem.

Výdělek v P0 je interní výpočet. Aplikace nevyplácí a neintegruje provize Shopify Collabs. Před pilotem je nutné určit jediný systém odpovědný za provize nebo doložit párování, které zabrání dvojímu odměnění objednávky. Při vyčerpání kampaně se zastaví nové nabídky benefitu; již vzniklé provize se nemažou. Objednávky mimo tento benefit podléhají původní affiliate dohodě a vykazují se odděleně.

Samostatný prodej kolekce navazuje po P0. Zákazník v něm hradí plnou maloobchodní cenu a creator dostává odměnu za produkt. Kalkulace musí pokrýt výrobu, dopravu, související náklady, odměnu creatorovi a poplatek platformě bez spoléhání na budoucí prodej Jackery.

## Výpočet rozpočtu a odměny

Interní výpočty používají jednu měnu, shodný daňový základ a přesnou peněžní aritmetiku. Pro P0 zvolte měnu produktu Arcade a odpovídající měnu testovacího obchodu; CZK příklad níže pouze ilustruje matematiku. Server odmítá neplatné nebo záporné náklady/limity, nesoulad měn, neplatné procento provize a přetečení. `M` může být záporné; taková objednávka není způsobilá.

| Symbol | Význam |
| --- | --- |
| M | Výnos běžné objednávky po slevách minus zboží, platba, expedice, dotovaná doprava a rezerva na vratky; před náklady této kampaně |
| K | Minimální příspěvek na zisk, který chce obchodník zachovat |
| B | Maximální výdaj kampaně na jednu objednávku |
| C | Provize z kvalifikovaných položek po slevách, bez daně, dopravy a creatorova produktu |
| F | Pevný poplatek platformě za kvalifikovaný benefit |
| G | Náklad produktu, dopravy a dalších nerefundovatelných složek na stejném daňovém základě jako M |
| S | Příspěvek obchodníka na creatorův produkt |
| D_net | Čistý příspěvek zákazníka použitelný na G po dani, inkasních poplatcích a dohodnuté rezervě |
| D_gross | Konečná částka, kterou by zákazník platil; v P0 se neinkasuje |

`A = max(0, min(B, M − K))`. Pokud `M < K` nebo `C + F > A`, nabídka není způsobilá. Jinak `S = min(G, A − C − F)` a `D_net = G − S`. Rezervuje se celý výdaj obchodníka `R = C + F + S`, nikoli jen dotace produktu. Musí platit `R ≤ A` a `M − R ≥ K`.

Pro případný budoucí doplatek odvoďte `D_gross` tak, aby po konkrétních daních a poplatcích zůstalo alespoň `D_net`. Tyto předpisy musí být explicitně nakonfigurované; bez nich zobrazte jen označenou interní simulaci a žádnou konečnou nabídku k úhradě. Náklady na inkaso nesmějí být současně v G i odečtené z D_gross. Po zaokrouhlení přepočítejte invarianty; při překročení limitu nabídku odmítněte. Modelovaný ani neuhrazený D_net není přijatá hotovost a nesmí financovat objednání výroby.

Ilustrativní interní příklad: `M = 5 000 Kč`, `K = 3 000 Kč`, `B = 2 000 Kč`, `C = 1 000 Kč`, `F = 200 Kč`. Na produkt zbývá 800 Kč. Při `G = 1 400 Kč` je čistý modelový doplatek 600 Kč a scénář zůstává mimo integrované plnění. Při `G = 800 Kč` je doplatek nula a lze předvést plně hrazený testovací nárok. Nejde o nabídku Arcade ani o ceny včetně zákaznické daně.

G musí mít položkový rozpad se zdrojem, datem, měnou a označením ověřeno/model. U případné zahrnuté royalty nebo marže dodavatele zaznamenejte příjemce a vztah k C/F, aby stejná odměna nebyla započtena dvakrát. Neznámá cena, doprava nebo dostupnost není nula. Výpočet nesmí předpokládat množstevní slevy ze slučování nezávislých objednávek.

Přepočet spouští změna košíku, slevy, produktu, varianty, země nebo nákladů. Předběžná kalkulace ze storefrontu je podmíněná, protože klientská data nejsou důkazem skutečné zaplacené objednávky. Závazný slib nebo navýšení doplatku nesmí vzniknout potichu po platbě. Neshodu řeší obchodník a výroba zůstává zablokovaná.

## Obrazovky MVP

| P0 obrazovka | Obsah |
| --- | --- |
| Pracovní plocha obchodníka | Stav připojení, přednastavená kampaň a podmínky, generování/schválení produktu, přehled objednávky a rozpočtu |
| Creatorova landing page | Příběh, schválený návrh, doporučené zboží a vysvětlení benefitu |
| Nabídka u košíku a výsledek | Příspěvek, stav nabídky, řízené CTA a pravdivé potvrzení testovacího nároku |

Creatorův výdělek lze pro demo ukázat jako kartu obchodníka označenou „čekající interní provize“. Samostatný creator dashboard a samoobslužná tvorba patří do P1. P0 generuje z promptu; upload referenčních obrázků je volitelný až po průchodu testovací objednávkou.

Komponenta nabídky má definované stavy: ověřujeme náklady, nezpůsobilý košík, příspěvek s nepodporovaným doplatkem, plně hrazená podmíněná nabídka, nedostupný rozpočet a nárok k ručnímu posouzení. Každý stav vysvětlí důvod a nabídne pokračovat bez benefitu nebo upravit košík. „Zdarma“ je přípustné pouze při nulovém doplatku; u modelových nákladů musí být přímo u nabídky „Simulace — bez objednání výrobku“. Žádný automatický progress bar neslibuje růst benefitu jen podle hodnoty košíku.

Na mobilu musí být čitelné výběr i potvrzení. Interní marže se zákazníkovi nezobrazuje. Změna creatorova odkazu před rezervací oznámí změnu nabídky a vyčistí neslučitelný výběr; aktivní rezervaci nový odkaz nepřepisuje. Pojmy jsou konzistentní: příspěvek na produkt pro zákazníka, nárok pro záznam po nákupu, provize pro creatora.

Demo jasně odlišuje data Arcade, Shopify testovací platbu a modelové náklady. Potvrzení nesmí tvrdit, že byl výrobek zaplacen, zadán do výroby nebo odeslán. U D_net > 0 nesmí CTA vyvolávat dojem, že Shopify inkasuje zobrazený doplatek.

## Integrace a technické hranice

Při vstupní kontrole repozitář obsahoval pouze zadání a .gitignore; aplikační kód ani zavedený stack neexistoval. Výchozí doporučení je TypeScript a oficiální Shopify CLI React Router template s relační databází. Využijte jeho autentizaci/session a ověřování webhooků místo stavby Shopify infrastruktury od začátku. Pro katalog a objednávky počítejte s `read_products` a `read_orders`; app proxy navíc vyžaduje odpovídající konfiguraci/oprávnění. Přesné scope potvrďte při instalaci, nepožadujte zápis produktů a slev bez rozšíření scope projektu. [Shopify scaffold](https://shopify.dev/docs/apps/build/scaffold-app).

Landing page běží přes Shopify app proxy, například `/apps/creator-rewards/<campaign>`. Nabídku košíku zobrazuje samostatný theme app block/embed aktivovaný ve vhodném demo tématu. Ověření podpisu proxy prokazuje původ požadavku přes Shopify, nikoli identitu přihlášeného obchodníka nebo pravost položek košíku. Proxy nepřenáší běžné cookies; atribuční token posílá storefront výslovně. [App proxy](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies).

Theme blok nepůsobí uvnitř checkoutu. Kontrolovaná cesta rezervuje benefit před vlastním přechodem do checkoutu, ostatní cesty benefit nezakládají. Cart attribute obsahuje pouze opaque reservation ID. I privátní atribut je klientsky ovlivnitelný: nikdy není důkazem ceny, nároku ani oprávnění. Výsledná objednávka se porovnává s neměnnými serverovými daty rezervace. [Theme extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration), [Cart API](https://shopify.dev/docs/api/ajax/reference/cart).

Předběžná atribuce: poslední platný creatorův token pro tento obchod v sedmidenním okně, bez slibu rozpoznání napříč zařízeními. Token je neuhodnutelný nebo podepsaný a svázaný s obchodem a aktivní kampaní. Uložení respektuje nastavení souhlasu; bez trvalého uložení funguje explicitní aktuální odkaz. Sedm dnů je návrhová volba. Rezervace a objednávka mají už konkrétní neměnnou verzi podmínek.

Zpracovávejte `orders/paid`, `orders/cancelled` a `refunds/create`. Před prací ověřte HMAC nad raw request body, očekávaný obchod a téma. Ověřenou událost trvale uložte a pak potvrďte příjem; samotné doručení není dokončené obchodní zpracování. Ukládejte delivery ID proti opakování transportu, ale jediný nárok vynucuje unikátní `(shop_id, order_id)`. Aktuální stav a částky Shopify objednávky ověřte serverovým čtením; retry nebo ruční reconciliation používají tutéž idempotentní cestu. [Ověření webhooků](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries).

Arcade volá pouze server. Načte podporované kategorie, ověří `canManufacture`, zahájí generování a sleduje job. U každé vytvářející operace, která podporuje `requestId`, jej uloží před voláním a retry odešle se stejným ID i tělem. Uloží job ID, product ID a konečný stav. `unitPrice = null` není nula; krátkodobé obrázky obnoví načtením produktu. Kategorie jewelry a její odlišný generovací postup jsou mimo P0. [Generování](https://docs.arcade.ai/api-reference/patterns/create-a-pattern), [varianty](https://docs.arcade.ai/api-reference/categories/retrieve-a-category), [cena](https://docs.arcade.ai/api-reference/products/retrieve-a-product).

Dokumentované `products/get` nedokládá celkovou dopravu do konkrétní země a `checkouts/create` neobsahuje pole pro shipping quote ani rozdělenou platbu. Z toho nelze usuzovat, že jiné obchodní možnosti Arcade neexistují; musí je potvrdit poskytovatel. P0 nevolá checkout ani neplatí výrobu. Pozdější checkout vrací samostatnou platební stránku a objednávka vzniká až platbou; u quantity 1 dokumentace požaduje `dropShip: true`, pokud účet nemá aktivní subscription. [Arcade checkout](https://docs.arcade.ai/api-reference/checkouts/create-a-checkout).

IOM není závislost MVP; náklady zadává operátor. Živé společné inkaso, doplatek a úhrada výroby vyžadují samostatné ověření před pilotem. P0 testovací nárok není skutečný závazek výrobce.

## Data a stavy

Ukládejte obchod, kampaň, verzi podmínek a souhlasu, produkty kolekce, ekonomické vstupy, kalkulaci, rezervaci, nárok, provizi a zpracované události. Každý objekt je svázán s obchodem; provider job/product ID mapujte na oprávněný obchod a kampaň.

Neměnná kalkulace `quote_id` obsahuje obchod, campaign/terms version, požadované Shopify varianty a množství, slevy, měnu a daňový základ, zemi, Arcade produkt/variantu, verzi nákladů, C/F/G/S/D_net, původ dat a platnost. `reservation_id` odkazuje na tuto kalkulaci. Jeden checkout/cart klíč může mít nejvýše jednu aktivní rezervaci; opakované rezervování vrací stejný výsledek. Jedna rezervace může být spotřebována nejvýše jednou objednávkou a jeden obchod/order má nejvýše jeden nárok. Změna košíku vyžaduje novou kalkulaci a transakční nahrazení dosud nespotřebované rezervace, nikoli druhou aktivní rezervaci. Vypršení kalkulace samo neuvolňuje peníze: další zpracování musí ověřit její obnovu nebo přejít do MANUAL_REVIEW.

| Událost | Povolený výsledek |
| --- | --- |
| Rezervování způsobilé nabídky | Atomicky vložit RESERVED a odečíst celé R od dostupného limitu |
| Ověřená shodná zaplacená objednávka | RESERVED → COMMITTED a právě jeden nárok PENDING_MANUAL_FULFILLMENT; výroba zůstává nezaplacená |
| Modelové náklady | Stejná cesta pouze v oddělené testovací evidenci; nárok MODEL_ONLY není použitelný pro reálné plnění |
| D_net > 0 | Pouze náhled / AWAITING_COPAY, bez výrobního příkazu a bez započtení platby; mimo úspěšnou P0 cestu |
| Duplicitní událost | Žádné nové čerpání, nárok ani provize |
| Neplatná vazba, změněná objednávka nebo nová země | MANUAL_REVIEW, bez automatického plnění |
| Ruční uvolnění nedokončené rezervace | RESERVED → RELEASED po serverovém ověření dostupného stavu, audit důvodu a operátora |
| Pozdní platba po RELEASED | Znovu atomicky rezervovat celé R, pokud jsou všechny podmínky splněny; jinak MANUAL_REVIEW bez automatického plnění |
| Storno doručené před oznámením o platbě | Aktuální zrušená objednávka nesmí být pozdní paid událostí znovu aktivována |
| Storno/refund po čerpání | Zrušit nevyřízený nárok a upravit čekající provizi, ale vrátit do limitu pouze prokazatelně uvolnitelný náklad |

Přechody, nárok a změna rozpočtu probíhají v jedné databázové transakci s kontrolou očekávaného původního stavu. Uchovávejte auditní zápisy rezervací, závazků, vzniklých nákladů a vrácení. Dostupný limit je celkový limit minus aktivní rezervace a dosud nevrácené závazky/náklady, započtené každý jednou. Již zaplacená výroba, nevratný poplatek nebo částečná vratka nejsou automaticky obnovený rozpočet. Pozdní platby a ruční zásahy nesmějí přepsat historii.

V P0 se nedokončené rezervace uvolňují ručně s výše uvedenou ochranou pozdních plateb. Automatická expirace a zákaznické řešení výjimek patří před pilot. Provize je čekající; potvrzení se řídí smluvenou verzí podmínek a vyplaceno vyžaduje skutečný doklad.

Povinné hranice přístupu pro P0:

- Administraci, náklady, schvalování, generování a uvolňování rezervací smí měnit pouze autentizovaný obchodník/operátor odvozený z ověřené Shopify session. Uživatelská URL nebo `shop_id` v těle požadavku neurčují oprávnění. URL validujte jako Shopify doménu; aplikace ji nesmí použít k libovolnému serverovému fetchi.
- Storefront smí načíst veřejnou schválenou kolekci a žádat o kalkulaci/rezervaci pro daný obchod. Nesmí zadávat ekonomické částky ani spouštět generování. Ověřujte podpis/původ, vlastníka objektu a CSRF/origin podle typu endpointu; citlivé změny neprovádějte přes GET.
- Limity na generovací joby podle obchodu a kampaně chrání náklady Arcade. Quote/reserve má limit podle obchodu a session a nejvýše jednu aktivní rezervaci na cart klíč, aby návštěvník nezablokoval celý rozpočet opakovanými požadavky.
- P1 creator účet vyžaduje expirovatelnou jednorázovou pozvánku, vlastní autentizaci a kontrolu přiřazení ke kampani. Přepínač role v demo UI tuto autentizaci nenahrazuje.
- Klíče a store tokeny zůstávají mimo klient, repozitář a logy; u nasazené aplikace jsou uložené v chráněném serverovém úložišti. Logy neobsahují raw objednávky ani osobní údaje, které P0 nepotřebuje. Neautorizované čtení cizího obchodu nebo jobu musí být odmítnuto.

Volitelný upload referencí používá skutečný Arcade upload/reference postup s limitem formátu a velikosti; nepřijímá libovolnou vzdálenou URL k serverovému stažení. Při chybě Arcade zobrazte chybu nebo dříve schválený produkt s platnými daty, ne předstíraný úspěch.

## Demo pro porotu

Přednastavenou administraci přeskočte a ukažte nejprve zákaznickou hodnotu:

| Čas | Děj |
| --- | --- |
| 0:00–0:30 | Fanoušek otevře creatorův odkaz a vybere jeho originální produkt |
| 0:30–1:10 | Dva košíky ukážou plné pokrytí a náhled s doplatkem; druhý je výslovně bez platební integrace |
| 1:10–2:00 | Plně hrazený scénář projde rezervací a Shopify testovací platbou; vznikne právě jeden nárok |
| 2:00–2:35 | Obchodník ukáže marži, celý náklad kampaně a čekající provizi creatora |
| 2:35–3:00 | Ukažte skutečný Arcade produkt a cenu a stručně odlište neprovedenou výrobu a modelové náklady |

Pitch: „Pomáháme značkám a creatorům proměnit část affiliate rozpočtu v originální produkty, které si fanoušci sami vyberou.“

Na příslušných místech používejte jednoznačná označení „Data Arcade“, „Shopify test“, „Modelové náklady“ a „Výroba neobjednána“. Generování může být připravené předem ze skutečného jobu. Pokud nelze ověřit dopravu, celé demo ukazuje finanční model a testovací nárok, nikoli závazný dárek pro zákazníka. To je přijatelná hranice hackathonového dema, ne hotový provoz.

## Kritéria dokončení MVP

| Kritérium | Důkaz |
| --- | --- |
| Skutečné napojení obou platforem | Autorizovaný vývojový Shopify katalog a skutečný Arcade product ID, obrázek, cena a job/request evidence |
| Jedna úplná cesta | Creatorův odkaz → výběr → rezervace → testovací platba → jeden nárok a čekající provize |
| Správná ekonomika | Hraniční příklady pod K, C+F nad A, plné pokrytí a D_net > 0; po zaokrouhlení platí invarianty |
| Doplatek není domyšlená tržba | D_net > 0 zůstává neuhrazený a nemůže povolit výrobu |
| Rezervuje se celý náklad | Dva souběžné požadavky rezervují C+F+S bez překročení limitu; opakované CTA nevytváří další hold |
| Vazba není falšovatelná | Změněný atribut, košík, sleva nebo země a checkout bez rezervace nevytvoří automatický nárok |
| Události jsou odolné vůči opakování a pořadí | Duplicate paid, cancel před paid, pozdní paid po release a závod release/paid nepřekročí limit ani neoživí storno |
| Storno nelže o nákladech | Nevyřízený nárok a čekající provize se upraví; nevratný náklad se nevrátí do limitu |
| Oprávnění a rozpočty API platí | Chybný HMAC, cizí shop/job ID a neautorizované generování jsou odmítnuty; limity jsou serverové |
| Potvrzení odpovídá skutečnosti | Uživatelská obrazovka nepředstírá inkaso doplatku, platbu Arcade, výrobu ani odeslání |
| Neznámé náklady blokují reálný slib | Chybějící doprava/cena vede k modelu nebo čekání na ověření, ne k závaznému produktu zdarma |

Předání tvoří běžící demo, zdrojový kód, návod bez secretů, ukázková kampaň a přehled ověření. Ten obsahuje cílový typ creatora, produkt, zemi, baseline affiliate nabídku a čtyři sloupce: ověřeno živě, ověřeno testovací objednávkou, modelová hypotéza, blokuje pilot. U obchodních metrik nejsou bez skutečného experimentu žádné výsledky.

## Co patří do další fáze

P1 přidá creatorovu samoobsluhu, pozvánky a dashboard, upload referencí a úpravy kampaní. Navazující obchodní rozšíření je samostatný prodej kolekce a skutečný doplatek; pro ně je nutné navrhnout a ověřit mapování produktu a ceny v Shopify, inkaso, refundy a úhradu Arcade. Nejde jen o odemčení tlačítka v P0.

Veřejné tržiště creatorů, další e-shopové platformy, IOM synchronizace, automatické výplaty, generování fanoušky, více zemí a měn a optimalizace nabídek jsou mimo MVP.

Před pilotem musí být doložený dodavatel pro vybranou zemi, úplné ceny, smluvní odpovědnost za prodej a reklamace, způsob inkasa a úhrady výroby, pravidla vratek a jediná evidence provizí vůči dosavadním affiliate nástrojům. Dále se musí vyřešit expirace rezervací, opožděné platby a zákaznická komunikace při nesplnění podmíněné nabídky. Případnou již slíbenou odměnu nelze zákazníkovi jednoduše odebrat jen proto, že systém nedokázal správně rezervovat rozpočet; obchodník potřebuje předem definovaný postup řešení a evidenci případné ztráty.

České doručení ani jiné země se nepředpokládají. Podporovaná země se volí podle skutečných podmínek konkrétního výrobce. Tento dokument nezakládá oprávnění ke spuštění produkce nebo finanční transakci.

## Vyhodnocení pilotu

Porovnejte dvě náhodně přiřazené skupiny návštěvníků stejného creatora: dosavadní affiliate nabídku a nabídku s jeho produktem. Přiřazení musí být stabilní pro daného návštěvníka a skupiny mají mít srovnatelné podmínky. A/B vyhodnocení není nutné implementovat pro hackathon, ale je podmínkou věrohodného obchodního ověření.

Hlavní metrikou je příspěvek na zisk na přivedeného návštěvníka po odečtení odměn, výroby, dopravy, poplatků a vratek. Vedlejší metriky jsou konverze, průměrná objednávka, podíl uplatněných odměn, příjem creatora na návštěvníka a náročnost obsluhy. Demo nesmí tato budoucí zlepšení vydávat za naměřené výsledky.

Projekt má pokračovat do pilotu, pokud se podaří dokončit reálnou platební a výrobní cestu, dohodnout přijatelnou ekonomiku s alespoň jedním existujícím creatorem a potvrdit dostupnost produktu pro zákazníky zvolené země.
