# Zadání prezentačního dema Creator Rewards

Priorita podle zadavatele: rychle ukázat myšlenku a přesvědčivě ji odprezentovat na hackathonu. Výstupem je interaktivní prototyp s připravenými daty, ne provozní affiliate platforma. Toto zadání nahrazuje předchozí integrační MVP jako aktuální rozsah práce.

## Co musí porota pochopit

Obchodník spolupracuje s creatorem, který prostřednictvím Arcade vytvoří vlastní kolekci. Fanoušek přijde do obchodu přes creatorův odkaz a může jeho výrobek koupit, získat na něj příspěvek nebo ho dostat zdarma ke kvalifikovanému nákupu. Creator získává příjem, zákazník osobní produkt a obchodník nový důvod k nákupu v rámci svého rozpočtu na spolupráci.

Hlavní sdělení: „Creatorův odkaz může zákazníkovi přinést originální výrobek, který si sám vybere. Obchodník financuje benefit z rozpočtu spolupráce.“

Přínos pro ILICO/Jackery je možnost rozšířit existující partnerství s influencery. Hypotézu o vyšší konverzi nebo zisku zatím neprezentujeme jako naměřený výsledek.

## Výstup a rozsah

Vytvořte lehké klikací webové demo se třemi scénami a jasným přepínáním mezi nimi. Použijte jeden ukázkový obchod, jednoho modelového creatora a jednu kolekci s jedním až třemi produkty. Interakce a výpočty mohou běžet lokálně v prohlížeči nad připravenými daty. Návrat na začátek musí demo resetovat.

Jádrem jsou výběr creatorova produktu, změna nabídky při změně košíku a přehled rozdělení peněz. Pro všechny varianty nákupní cesty se používají stejné modelové částky. Samostatný prodej stačí ukázat jako jednu alternativu nabídky; nemusí mít vlastní checkout.

Povinný technický rozsah nezahrnuje instalaci do Shopify, OAuth, webhooky, evidenci skutečných objednávek, rezervace peněz, databázi, registrace, skutečné výplaty ani provozní monitoring. Jde o pozdější implementaci. Nepřidávejte affiliate framework ani vlastní instalaci Dubu jen kvůli tomuto demu.

## Tři scény

| Scéna | Co divák udělá a uvidí |
| --- | --- |
| Creator vytváří kolekci | Ukázkový creator zadá motiv nebo vybere připravenou inspiraci. Zobrazí se skutečný výsledek z Arcade a tlačítko pro náhled jeho nabídky v obchodě. |
| Fanoušek nakupuje | Otevře creatorovu nabídku v ukázkovém e-shopu, vybere design a přepne mezi dvěma košíky. Uvidí cenu produktu, příspěvek obchodu a doplatek, případně plné financování produktu. |
| Obchodník a creator vidí výsledek | Po simulovaném dokončení nákupu se zobrazí modelový rozpad: provize creatora, příspěvek na produkt, poplatek platformě a částka zbývající obchodníkovi. |

V první scéně lze krátce ukázat pole pro URL obchodu a přednastavený obchod. Je to vizualizace budoucího onboardingu, nikoli skutečná instalace. Samostatná nastavovací administrace není potřeba.

Produkt musí mít vlastní estetickou hodnotu. Nevynucujte logo Jackery, reklamní slogan ani firemní barvy. Použijte podporovanou kategorii Arcade, například textilní produkt vhodný pro příběh cestovatelského creatora. Co je pouze vizuální návrh, nesmí být popsáno jako vyrobený fyzický kus.

## Co bude skutečné a co simulované

Arcade má být doloženou součástí dema: použijte alespoň jeden skutečný návrh nebo produkt vytvořený přes Arcade s dohledatelným původem. Přednost má již připravený výsledek a oprávněné připojení z existující session. Živá generace během prezentace je volitelná; pokud trvá dlouho, otevřete připravený výsledek a řekněte, že vznikl předem.

Nové volání Arcade je možné doplnit pouze tehdy, pokud je připojení připravené a nezdrží hlavní příběh. API klíč zůstává na serveru. Pro statickou připravenou variantu není server vůbec nutný. Při opakování dema automaticky nespouštějte nové placené operace.

E-shop, creatorův odkaz, košík, objednávka, provize i ekonomické vstupy mohou být simulované. Na prototypu bude viditelné označení „Interaktivní demo — ukázková data“. Po dokončení se objeví „Simulace dokončena — žádná platba ani objednávka neproběhla“. Ukázková instalace se nesmí označovat jako skutečně připojený Shopify obchod.

Cenu získanou z Arcade označte jako cenu daného produktu; modelovou dopravu nebo daň neslučujte bez vysvětlení do údajně ověřené nabídky. Konkrétní dostupnost v ČR, výrobu a doručení není nutné pro prezentaci dokazovat, ale nesmějí se slibovat jako ověřené.

## Jednoduchá ekonomika pro demo

Použijte dva přednastavené scénáře. Čísla níže jsou interní modelové částky v USD, nikoli skutečné ceny Arcade ani zákaznická nabídka včetně daní.

| Položka | Menší košík | Větší košík |
| --- | ---: | ---: |
| Rozpočet obchodníka na spolupráci | 160 | 220 |
| Provize creatora | 60 | 60 |
| Poplatek platformě | 20 | 20 |
| Příspěvek obchodu na produkt | 80 | 140 |
| Modelový celkový náklad produktu | 140 | 140 |
| Modelový doplatek fanouška | 60 | 0 |

Rozpočet v reálném provozu musí vycházet z marže objednávky. Pro demo stačí připravená data, která tuto podmínku splňují: například příspěvek běžné objednávky před kampaní 460 a 520 USD, po odečtení kampaně v obou případech zbývá 300 USD. Nevytvářejte obecný účetní engine. Změna košíku jen přepne konzistentní scénář a animuje rozpad peněz.

Creator musí s rozdělením odměny souhlasit; snížení jeho běžné provize není automatická výhoda. V prezentaci vysvětlete, že přínos pro něj chceme ověřit vyšším počtem přivedených objednávek a možností samostatného prodeje kolekce.

## Příběh prezentace na dvě minuty

1. Prvních 20 sekund: „Značky již spolupracují s influencery. Chceme jejich spolupráci rozšířit o produkty, které si fanoušci sami vyberou.“ Ukázat creatorův návrh z Arcade.
2. Dalších 45 sekund: otevřít creatorův odkaz, vybrat design a změnit košík. Ukázat, jak se částečný příspěvek změní na plné financování produktu.
3. Dalších 35 sekund: simulovat dokončení a zobrazit rozdělení peněz. Zdůraznit, kdo co získá a že náklad obchodu zůstává uvnitř připraveného rozpočtu.
4. Posledních 20 sekund: ukázat budoucí produkt — aplikaci pro obchody s vlastními creator partnery — a vysvětlit, že další krok je pilot s jedním skutečným partnerem.

Provozní integrace jsou součástí navazujícího vývoje. Prezentace nemá dokazovat hotový platební systém ani naměřený růst prodejů. Má prokázat srozumitelnou hodnotu pro všechny tři strany a konkrétní roli Arcade.

## Pořadí práce a kritéria hotového dema

Nejprve vyberte dostupný vizuál Arcade a připravte celý dvouminutový průchod. Poté postavte tři propojené scény a modelový výpočet. Následuje vizuální doladění a nácvik prezentace. Živé generování, další produkty a animace přidávejte až při zbývajícím čase.

Demo je hotové, když:

- všechny tři scény fungují v jednom průchodu a dají se resetovat;
- alespoň jeden výsledek má doložený původ v Arcade;
- změna košíku změní příspěvek a doplatek podle stejné kalkulace;
- divák vidí výhodu fanouška, příjem creatora a ekonomiku obchodníka;
- simulovaná objednávka ani provize nejsou vydávané za skutečnou transakci;
- existuje připravený výsledek pro případ pomalého API a prezentace se vejde do dvou minut.

Technické podklady z předchozí revize jsou zachované v [referenčním návrhu pro budoucí implementaci](2026-10-11-creator-rewards-technical-reference.md). Nejsou podmínkou dokončení tohoto prezentačního prototypu.

Aktualizace zadavatele: všechny modelové částky a prezentace používají USD. Nejde o přepočet původního CZK modelu kurzem.
