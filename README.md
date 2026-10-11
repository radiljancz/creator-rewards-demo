# Creator Rewards — functional local demo

Lokální hackathon demo s editovatelnou kampaní, creator odkazem, widgetem, živými událostmi a uloženým skutečným Arcade produktem.

Aktuální propojené demo: `http://127.0.0.1:3100/present`, merchant studio: `http://127.0.0.1:3100/`. Spuštění v již nakonfigurovaném prostředí: `PORT=3100 ARCADE_MODE=live npm start`. Otevření obrazovky nespouští generování.

Původní backend vychází z [backend handoffu](docs/backend-handoff.md). Všechny modelové peníze jsou **USD v integer centech**. Žádná platba, objednávka ani výplata se neprovádí.

```sh
npm start
```

Otevřete `http://127.0.0.1:3000/api/demo/campaign`. Node >=24, ověřeno na 26.8.1; nejsou potřeba žádné npm závislosti ani build. Výchozí režim `mock`. SQLite je v ignorovaném `data/demo.sqlite`. Služba povoluje pouze loopback.

```sh
npm test
```

Testy používají lokální HTTP server a SQLite, nikdy skutečný provider. API a příklady: [docs/backend-api.md](docs/backend-api.md). Implementační plán: [docs/superpowers/plans/2026-10-11-demo-backend.md](docs/superpowers/plans/2026-10-11-demo-backend.md).

Existující `.env.local` obsahuje serverový klíč. **Nepřepisujte jej kopírováním `.env.example`.** Doplňte pouze potřebná nastavení podle [.env.example](.env.example). `DEMO_OPERATOR_TOKEN` zapíná chráněné operátorské POSTy; klíč ani token nepatří do klientského JavaScriptu. Legacy API používá tento token; nové lokální studio používá chráněnou same-origin operátorskou session. Veřejně nevystavujte celý lokální server.

Read-only ověření účtu:

```sh
node --env-file=.env.local backend/inventory.mjs
```

Tento příkaz pouze načte kategorie a existující produkty, nevytváří job. Snapshot zůstává v ignorovaném `data/arcade-inventory.json`. `ARCADE_MODE=live npm start` načte kategoriální volby; generace začíná až autorizovaným `POST /api/designs`. Každý návrh má dva provider kroky a počítá se do trvalého limitu `DEMO_MAX_DESIGNS` (default 3). Reset obrazovky tento limit ani návrhy nemaže.

Stav 2026-10-11: skutečný Arcade produkt `02f5575a-78c3-41b6-9df5-b6517adc1d71` je uložený a jeho náhled byl načten v prohlížeči. API uvádí 40.56 USD za kus; doprava a daně nebyly ověřeny. Náklad kampaně 140 USD zůstává samostatným editovatelným demo předpokladem. Personalizace v UI je textový náhled; není schváleným výrobním podkladem. Oddělený derivative backend viz [live handoff](docs/arcade-live-handoff.md).

Veřejný obchod ani Shopify zatím nejsou připojené. Pouhé vyplnění URL neinstaluje widget. Výchozí lokální služba obsahuje operátorské funkce a nesmí být přímo tunelována. Pro veřejnou demonstraci se připravuje samostatná brána s povolenými veřejnými endpointy.
