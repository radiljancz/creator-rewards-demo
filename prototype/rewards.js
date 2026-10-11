/* Creator Rewards demo embed. No checkout, payment or manufacturing is performed. */
(() => {
  'use strict';
  if (window.CreatorRewards) return;
  const script = document.currentScript;
  const sourceOrigin = new URL(script.src, location.href).origin;
  const apiOrigin = new URL(script.dataset.apiOrigin || sourceOrigin);
  if (script.dataset.apiOrigin && (apiOrigin.protocol !== 'https:' || script.dataset.apiOrigin !== apiOrigin.origin)) throw new Error('Widget API origin must be an exact HTTPS origin.');
  const base = apiOrigin.origin;
  const campaignId = script.dataset.campaign || 'main';
  const storageKey = `creator-rewards:${base}:${campaignId}`;
  const remove = key => { try { sessionStorage.removeItem(key); } catch {} };
  const read = key => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, value); } catch {} };
  const sessionId = read(`${storageKey}:session`) || crypto.randomUUID();
  write(`${storageKey}:session`, sessionId);
  let config, creatorId, rewardId, items = [], quote, personalization = '', requestVersion = 0, busy = false;
  let rewardChosen = false;
  const storefront = script.dataset.storefront === 'true';
  let personalRecord = null, personalHistory = [], viewedPersonalId = null, historyVersion = '', historyReadVersion = 0, loadedPreviewUrl = '', failedPreviewUrl = '', personalBusy = false, personalPollBusy = false, personalError = '', bootstrapBusy = false;
  const personalActive = new Set(['queued', 'starting', 'running']);
  const host = document.createElement('div');
  host.id = 'creator-rewards-widget';
  const slot = document.getElementById('creator-rewards-slot');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
  :host{display:block;color:#193b47;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;--orange:#ef713f;--ink:#193b47}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.55;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #ef713f;outline-offset:3px}.card{background:#fffdf8;border:1px solid #d9e2df;border-radius:22px;padding:23px;box-shadow:0 12px 45px #193b4710}.floating{position:fixed;bottom:85px;right:20px;width:min(390px,calc(100vw - 32px));max-height:calc(100dvh - 115px);overflow:auto;z-index:2147483000}.launcher{position:fixed;bottom:20px;right:20px;z-index:2147483001;border:0;border-radius:99px;background:var(--ink);color:white;padding:14px 22px;box-shadow:0 5px 20px #193b4730}.top{display:flex;justify-content:space-between;gap:10px;align-items:start}.eyebrow{font-size:10px;font-weight:750;letter-spacing:1.5px;text-transform:uppercase;color:#438073;margin:0 0 8px}h2{font-size:25px;letter-spacing:-1px;line-height:1.15;margin:0 0 8px}.muted{font-size:11px;color:#647981}.close{border:0;background:transparent;font-size:22px;padding:0 5px;color:var(--ink)}.art{position:relative;aspect-ratio:1;min-height:0;background:#e8eeeb;border-radius:15px;overflow:hidden;margin:18px 0 9px;display:grid;place-items:center}.art img{position:absolute;inset:0;width:100%;height:100%;min-width:0;min-height:0;object-fit:contain;display:block}.designs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.design-choice{padding:8px;border:1px solid #d6e1df;border-radius:10px;background:white;text-align:left;color:var(--ink);min-width:0;font-size:11px;line-height:1.3}.design-choice[aria-checked=true],.design-choice[aria-pressed=true]{border:2px solid #307e65;padding:7px;background:#e9f2ec}.design-choice img{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#eef1ee;border-radius:5px;margin-bottom:6px}.image-status{position:absolute;inset:0;display:grid;place-items:center;padding:25px;text-align:center;color:#647981;font-size:12px}.request-progress{position:sticky;top:0;z-index:2;margin:10px 0;padding:12px;background:#e9f2ec;border:1px solid #307e65;border-radius:10px;font-size:12px;font-weight:650}.generation-status{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:15px;padding:25px;background:#fffdf8ed;text-align:center;font-weight:650}.generation-status::before{content:"";width:32px;height:32px;border:3px solid #d6e1df;border-top-color:#307e65;border-radius:50%;animation:arcade-spin 1s linear infinite}@keyframes arcade-spin{to{transform:rotate(360deg)}}.proof{font-size:10px;color:#647981;margin:0 0 16px}label{display:block;font-size:11px;font-weight:700;margin:13px 0 6px}select,input{width:100%;border:1px solid #d6e1df;border-radius:9px;color:var(--ink);background:white;padding:10px 11px}input{font-size:13px}.text-row{display:flex;align-items:center;gap:8px}.text-row span{font-size:10px;color:#647981;white-space:nowrap}.reward{margin-top:19px;background:#e9f2ec;border-radius:12px;padding:18px}.amountrow,.line{display:flex;justify-content:space-between;align-items:center;gap:8px}.amount{font-size:36px;font-weight:750;letter-spacing:-1.5px}.tag{font-size:10px;background:#d4e7dc;padding:4px 8px;border-radius:50px;color:#27715c}.line{font-size:11px;margin-top:8px}.bar{height:5px;background:#cbded3;border-radius:9px;margin-top:13px;overflow:hidden}.fill{height:100%;background:#307e65;width:0;transition:width .3s}.choose{margin-top:10px;width:100%;border:1px solid #d6e1df;border-radius:9px;padding:8px;background:white;color:var(--ink);font-size:11px;font-weight:700}.primary{border:0;border-radius:10px;background:var(--orange);color:white;font-weight:700;padding:13px;width:100%;margin-top:15px}.status{font-size:11px;line-height:1.5;margin-top:12px;min-height:17px}.status[data-error=true]{color:#b0432b}.fine{font-size:10px;color:#647981;margin:10px 0 0}.hidden,[hidden]{display:none!important}.empty{padding:15px 0;color:#647981;font-size:13px}@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
  .card{padding:21px;box-shadow:0 8px 28px #193b4708}h2{font-size:24px;letter-spacing:-.7px}.eyebrow{letter-spacing:0;text-transform:none;font-size:11px;margin-bottom:6px}.offer-intro{font-size:12px;color:#647981;margin:10px 0 0}.art{width:100%;height:205px;aspect-ratio:auto;margin:16px 0 8px;border:0;padding:0;cursor:zoom-in}.zoom-hint{position:absolute;bottom:10px;right:10px;background:#fffdf8ed;border:1px solid #d9e2df;border-radius:20px;padding:5px 10px;font-size:11px;font-weight:650;color:var(--ink)}.art:disabled{opacity:1;cursor:default}.art:disabled .zoom-hint{display:none}.proof{margin-bottom:10px}.reward{margin:12px 0 0;padding:14px 16px}.amount{font-size:32px}.bar{display:none}.primary{margin-top:12px}.skip{width:100%;background:transparent;border:1px solid #b5c5bf;color:var(--ink);border-radius:10px;padding:11px;margin-top:8px;font-size:12px;font-weight:650}.choice-note{font-size:11px;color:#647981;text-align:center;margin-top:7px}.options{border-top:1px solid #d9e2df;margin-top:17px;padding-top:12px}.options summary{cursor:pointer;font-size:12px;font-weight:650;min-height:30px;padding:4px 0}.options summary:focus-visible{outline:3px solid var(--orange);outline-offset:3px}.designs{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.design-choice{font-size:10px}.design-choice img{aspect-ratio:1}.dismissed{background:#fffdf8;border:1px solid #d9e2df;border-radius:16px;padding:20px}.dismissed strong{display:block;font-size:16px;margin-bottom:5px}.dismissed p{font-size:12px;color:#647981;margin:0}.reopen{border:0;background:transparent;color:#307e65;text-decoration:underline;text-underline-offset:3px;padding:10px 0 0;font-size:12px}.preview-dialog{width:min(920px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:18px;border:1px solid #d9e2df;border-radius:18px;background:#fffdf8;color:var(--ink);overflow:auto}.preview-dialog::backdrop{background:#102d38b8}.dialog-head{display:flex;align-items:start;justify-content:space-between;gap:20px;margin-bottom:12px}.dialog-head h2{font-size:18px;letter-spacing:-.3px;margin:0}.dialog-head p{font-size:12px;color:#647981;margin:4px 0 0}.dialog-image{display:block;width:100%;height:min(68dvh,720px);object-fit:contain;background:#e8eeeb;border-radius:10px}.dialog-close{border:1px solid #d9e2df;border-radius:8px;padding:6px 12px;background:white;color:var(--ink);font-size:12px;white-space:nowrap}.original-link{display:inline-block;margin-top:10px;color:#307e65;font-size:12px}.status:empty{display:none}.close{font-size:20px}.request-progress{position:static}.personal-fields{padding-top:2px}@media(max-width:480px){.preview-dialog{padding:12px}.dialog-head h2{font-size:16px}.dialog-image{height:60dvh}.art{height:230px}}
  </style>
  <section class="card" aria-label="Optional creator extra">
    <div class="top"><div><p class="eyebrow">Optional extra with your setup</p><h2>A keepsake for your trip</h2><div id="creator" class="muted">Loading the collection…</div></div><button class="close" aria-label="Decline creator extra">×</button></div>
    <p class="offer-intro">Pick a creator design. Your setup covers part of the cost; you pay only the extra shown below.</p>
    <div id="content" hidden>
      <button type="button" class="art" id="preview" aria-busy="false" aria-label="Enlarge selected design" aria-haspopup="dialog" disabled><img id="image" alt="Creator product preview" referrerpolicy="no-referrer"><span class="image-status" id="image-status" role="status">Loading product preview…</span><span class="generation-status" id="generation-status" role="status" aria-live="polite" hidden></span><span class="zoom-hint">⤢ View larger</span></button>
      <p class="proof" id="provenance"></p>
      <div class="reward" aria-live="polite"><div class="amountrow"><div><span class="muted">Extra to pay with this design</span><div class="amount" id="copay">—</div></div><span class="tag" id="tag">Select a basket</span></div><div class="bar"><div class="fill" id="fill"></div></div><div class="line"><span>Covered by your setup</span><strong id="subsidy">—</strong></div><div class="line" id="cost-row"><span>Design price · demo estimate</span><span id="cost">—</span></div></div>
      <button class="primary" id="simulate" disabled>Simulate with this extra</button>
      <button class="skip" id="decline">No thanks, just my setup</button>
      <p class="choice-note">Entirely optional. Your setup stays the same.</p>
      <details class="options"><summary>Explore other designs</summary><p id="design-label" class="muted">Select a design to preview it above.</p><div class="designs" id="designs" role="radiogroup" aria-labelledby="design-label"></div><select id="reward" hidden aria-label="Choose a creator design"></select><button class="choose" id="choose" hidden>Choose this design</button></details>
      <details class="options" id="personal-options"><summary>Personalize your design <span class="muted">(optional)</span></summary><div class="personal-fields"><label for="personal">Add a place, name or year</label><div class="text-row"><input id="personal" maxlength="32" placeholder="Yosemite 2027" autocomplete="off"><span id="count">0 / 32</span></div><button class="choose" id="generate" disabled>Generate my design</button><button class="choose" id="recover" hidden>Recover Arcade request</button><p class="status" id="personal-status" role="status" aria-live="polite">Add a place or year to create your own Arcade design.</p><p class="fine">Creating a design can take a few minutes. You can skip this extra and continue with your setup at any time.</p></div></details>
      <p class="request-progress" id="request-progress" role="status" aria-live="polite" hidden></p><button class="choose" id="view-current" hidden>View current request</button><label id="history-label" hidden>Your personal designs</label><div class="designs" id="personal-history" role="group" aria-labelledby="history-label"></div>
      <p class="fine">Demo only. No payment, order, creator payout or manufacturing.</p>
    </div><p class="status" id="status" role="status"></p><button class="choose" id="retry-load" hidden>Retry connection</button>
  </section>
  <section class="dismissed" id="dismissed" hidden aria-label="Creator extra declined"><strong>Just your setup. All good.</strong><p>No creator extra added. Continue with your selected setup.</p><button class="reopen" id="reopen">Show the optional extra again</button></section>
  <dialog class="preview-dialog" id="preview-dialog" aria-labelledby="dialog-title"><div class="dialog-head"><div><h2 id="dialog-title">Your selected design</h2><p id="dialog-caption"></p></div><button class="dialog-close" id="close-preview" autofocus>Close ✕</button></div><img class="dialog-image" id="dialog-image" alt="" referrerpolicy="no-referrer"><a class="original-link" id="original-image" target="_blank" rel="noopener noreferrer">Open full-size image in a new tab ↗</a></dialog>
  <button class="launcher" hidden>Open creator collection ↗</button>`;
  const $ = id => shadow.getElementById(id);
  const card = shadow.querySelector('.card');
  if (storefront) { host.dataset.storefront = 'true'; $('cost-row').hidden = true; $('choose').hidden = false; $('choose').textContent = 'Use this design'; }
  if (slot) slot.append(host);
  else { card.classList.add('floating'); card.hidden = true; shadow.querySelector('.launcher').hidden = false; shadow.querySelector('.close').hidden = false; (document.body || document.documentElement).append(host); }
  function status(message = '', error = false) { $('status').textContent = message; $('status').dataset.error = String(error); }
  function money(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: config?.currency || 'USD', maximumFractionDigits: 2 }).format(value / 100); }
  async function api(path, data) {
    const headers = /\.ngrok-free\.(dev|app)$|\.ngrok\.(app|dev|io)$/.test(new URL(base).hostname) ? { 'ngrok-skip-browser-warning': '1' } : {};
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}/api/growth/${path}`, { credentials: 'omit', headers, ...(data === undefined ? {} : { method: 'POST', body: JSON.stringify(data) }) });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error?.message || result.message || 'The reward service could not complete this action.'); error.httpStatus = response.status; error.code = result.error?.code; throw error; }
    return result;
  }
  async function event(type, extra = {}) {
    if (!creatorId || creatorId !== config?.creator.id) throw new Error('Open a valid creator link to join this campaign.');
    return api('events', { campaignId, creatorId, sessionId, eventId: crypto.randomUUID(), type, ...extra });
  }
  function personalData() { const record = personalizedRecord(); return record ? { personalization: { text: record.input.text }, personalizationId: record.id } : {}; }
  function revalidateReferral() {
    const params = new URLSearchParams(location.search);
    const candidate = params.has('creator') ? params.get('creator') : read(`${storageKey}:creator`);
    creatorId = candidate === config.creator.id ? candidate : null;
    if (creatorId) write(`${storageKey}:creator`, creatorId);
    else { remove(`${storageKey}:creator`); $('simulate').disabled = true; }
  }
  const choiceKey = () => `${storageKey}:chosen:${creatorId || 'preview'}:${sessionId}`;
  function chooseReward(chosen) { rewardChosen = Boolean(chosen && creatorId); if (rewardChosen) write(choiceKey(), '1'); else remove(choiceKey()); }
  const dismissalKey = () => `${storageKey}:declined:${creatorId || 'preview'}`;
  function setOfferDeclined(declined, focus = false) {
    if (declined) { write(dismissalKey(), '1'); chooseReward(false); } else remove(dismissalKey());
    card.hidden = declined;
    $('dismissed').hidden = !declined || !slot;
    if (focus) (declined ? (slot ? $('reopen') : shadow.querySelector('.launcher')) : shadow.querySelector('.close')).focus();
    window.dispatchEvent(new CustomEvent('creator-rewards:offer', { detail: { declined } }));
    window.dispatchEvent(new CustomEvent('creator-rewards:view', { detail:getView() }));
  }
  function openPreview() {
    if ($('image').hidden || !$('image').naturalWidth || !$('generation-status').hidden) return;
    $('dialog-image').src = $('image').src;
    $('dialog-image').alt = $('image').alt;
    $('dialog-title').textContent = $('image').alt;
    $('dialog-caption').textContent = $('provenance').textContent;
    $('original-image').href = $('image').src;
    $('preview-dialog').showModal();
  }
  let imageTimer;
  function drawImage() {
    const selected = personalizedRecord();
    const source = config.rewards.find(r => r.id === rewardId) || (selected ? {id:rewardId, name:selected.state.product.name || 'Saved personal design', imageSource:'arcade'} : null);
    if (!source) return;
    const reward = selected ? { ...source, ...selected.state.product, name: source.name + ' — ' + personalization } : source;
    const image = $('image'), message = $('image-status');
    const price = reward.providerUnitPrice;
    $('provenance').textContent = personalized() ? `Your Arcade design · ${personalization}${price ? ` · ${price.amount} ${price.currency}, before shipping and tax` : ''}` : reward.imageSource === 'arcade' ? 'Creator original · Generated with Arcade' : 'Illustrative concept · Personalization unavailable';
    image.alt = reward.name;
    $('preview').disabled = true;
    let url;
    const imageUrl = reward.id === 'coastal-pillow' && script.dataset.illustrativeImageUrl ? script.dataset.illustrativeImageUrl : reward.imageUrl;
    try { url = new URL(imageUrl, base); if (url.protocol !== 'https:' && url.origin !== base) throw new Error('Unsupported image URL'); }
    catch { clearTimeout(imageTimer); image.removeAttribute('src'); image.hidden = true; message.hidden = false; message.textContent = 'Product preview unavailable. Choose another design.'; return; }
    if (image.src === url.href && image.complete && image.naturalWidth > 0) { loadedPreviewUrl = url.href; $('preview').disabled = !$('generation-status').hidden; return; }
    if (image.src === url.href && !image.complete && !failedPreviewUrl) return;
    clearTimeout(imageTimer);
    loadedPreviewUrl = ''; failedPreviewUrl = '';
    image.hidden = true; message.hidden = false; message.textContent = 'Loading product preview…';
    image.onload = () => { if (image.src !== url.href || !image.complete || !image.naturalWidth) return; clearTimeout(imageTimer); loadedPreviewUrl = url.href; failedPreviewUrl = ''; image.hidden = false; message.hidden = true; updatePersonalControls(); };
    image.onerror = () => { if (image.src !== url.href) return; clearTimeout(imageTimer); failedPreviewUrl = url.href; image.hidden = true; message.hidden = false; message.textContent = 'Product preview could not load. Choose this design again to retry.'; updatePersonalControls(); };
    image.src = url.href;
    imageTimer = setTimeout(() => { if (!image.complete) message.textContent = 'The product preview is still loading. Your selection is available below.'; }, 8000);
  }
  async function refreshQuote() {
    const version = ++requestVersion;
    quote = null; $('simulate').disabled = true;
    if (!items.length || !rewardId || !config.rewards.some(reward => reward.id === rewardId)) { $('copay').textContent = '—'; $('tag').textContent = 'Select a basket'; $('subsidy').textContent = '—'; $('fill').style.width = '0'; if (rewardId && !config.rewards.some(reward => reward.id === rewardId)) status('This saved design is view-only; its creator original is no longer in the collection.'); return; }
    try {
      const result = await api('quote', { campaignId, items, rewardId });
      if (version !== requestVersion) return;
      quote = result;
      $('copay').textContent = money(result.fanCopay);
      $('subsidy').textContent = money(result.merchantSubsidy);
      $('cost').textContent = money(result.productCost);
      $('tag').textContent = !result.eligible ? 'No campaign benefit' : result.fanCopay === 0 ? 'Fully covered' : 'Partly covered';
      $('fill').style.width = `${result.productCost ? Math.min(100, result.merchantSubsidy / result.productCost * 100) : 0}%`;
      $('simulate').disabled = busy || personalBusy || !creatorId || !result.eligible || Boolean(personalization && (!personalized() || !personalPreviewReady()));
      if (!result.eligible) status('This basket does not meet the campaign economics. Try another product.');
    } catch (error) { if (version === requestVersion) status(error.message, true); }
  }
  function drawConfig() {
    $('creator').textContent = `A collection by ${config.creator.name}`;
    const previous = rewardId;
    if (!config.rewards.some(r => r.id === rewardId) && !viewedPersonalId) rewardId = config.rewards.find(r => r.imageSource === 'arcade')?.id || config.rewards[0]?.id;
    $('reward').replaceChildren(...config.rewards.map(reward => { const option = document.createElement('option'); option.value = reward.id; option.textContent = reward.name; return option; }));
    $('reward').value = rewardId || '';
    $('content').hidden = !rewardId;
    $('cost').textContent = money(config.rewardCost);
    drawDesignChoices(); drawImage(); updatePersonalControls();
    if (!rewardId) status('The creator collection is not ready yet.');
    return previous !== rewardId;
  }
  async function loadConfig() {
    if (bootstrapBusy) return null;
    bootstrapBusy = true; $('retry-load').disabled = true;
    try {
      config = await api(`public?campaign=${encodeURIComponent(campaignId)}`);
      revalidateReferral(); rewardChosen = read(choiceKey()) === '1';
      if (read(dismissalKey()) === '1') setOfferDeclined(true);
      drawConfig();
      await restorePersonalization();
      await loadPersonalHistory();
      if (creatorId) {
        const visitKey = `${storageKey}:visited:${sessionId}:${creatorId}`;
        if (!read(visitKey)) { await event('visit'); write(visitKey, '1'); }
        status();
      } else status('Explore the collection. Open a valid creator link to join this campaign.');
      await refreshQuote();
      $('retry-load').hidden = true;
      return config;
    } catch (error) { status(error.message, true); $('retry-load').hidden = false; return null; }
    finally { bootstrapBusy = false; $('retry-load').disabled = false; }
  }
  const ready = loadConfig();
  async function setBasket(next) {
    items = Array.isArray(next) ? next.map(item => ({ productId: item.productId, quantity: item.quantity })) : [];
    await ready;
    if (!config) return;
    status(creatorId ? 'Updating your creator benefit…' : 'Preview only. Open a creator link to join this campaign.');
    await refreshQuote();
    if (quote && creatorId) {
      try { await event('basket_updated', { items, rewardId }); status(quote.eligible ? '' : 'This extra is unavailable with this setup. You can continue without it.'); }
      catch (error) { status(error.message, true); }
    }
    return quote;
  }
  async function selectReward() {
    chooseReward(true); clearViewedDesign(); rewardId = $('reward').value; updateDesignChoices(); drawImage(); updatePersonalControls(); status('Updating your selection…');
    await refreshQuote();
    if (!creatorId) { status('Preview only. Open a creator link to join this campaign.'); return; }
    try { await event('reward_selected', { rewardId, ...personalData() }); status(personalized() ? 'Your Arcade personal design is selected.' : 'Your creator design is selected.'); }
    catch (error) { status(error.message, true); }
  }
  async function confirmReward() {
    await ready;
    if (!creatorId || !config.rewards.some(reward => reward.id === rewardId) || (personalization && (!personalized() || !personalPreviewReady()))) return;
    chooseReward(true); updatePersonalControls();
    try { await event('reward_selected', {rewardId, ...personalData()}); window.dispatchEvent(new CustomEvent('creator-rewards:selection', {detail:getView()})); }
    catch (error) { status(error.message, true); }
  }
  async function simulate() {
    await ready;
    if (busy || personalBusy || !creatorId || !items.length || !rewardId || (personalization && (!personalized() || !personalPreviewReady()))) return;
    busy = true; $('simulate').disabled = true;
    try {
      await refreshQuote();
      if (!quote?.eligible || !creatorId || creatorId !== config.creator.id) return;
      await event('checkout_simulated', { rewardId, items, ...personalData() });
      status('Simulation complete. Recorded in the live dashboard. No payment or order was placed.');
      $('simulate').textContent = 'Simulation recorded ✓';
    } catch (error) { status(error.message, true); }
    finally { busy = false; updatePersonalControls(); }
  }
  function designImageUrl(reward) {
    const value = reward.id === 'coastal-pillow' && script.dataset.illustrativeImageUrl ? script.dataset.illustrativeImageUrl : reward.imageUrl;
    try { const url = new URL(value, base); return url.protocol === 'https:' || url.origin === base ? url.href : null; } catch { return null; }
  }
  function updateDesignChoices() {
    const buttons = $('designs').children;
    for (let i = 0; i < buttons.length; i++) {
      const selected = config.rewards[i].id === rewardId;
      buttons[i].setAttribute('aria-checked', String(selected)); buttons[i].tabIndex = selected ? 0 : -1;
      const reward = config.rewards[i], personal = selected && personalized();
      const url = designImageUrl(personal ? {...reward, ...personalizedRecord().state.product} : reward);
      if (url && buttons[i].children[0].src !== url) buttons[i].children[0].src = url;
      buttons[i].children[1].textContent = personal ? `${reward.name} — ${personalization}` : reward.name;
    }
  }
  function drawDesignChoices() {
    $('designs').replaceChildren(...config.rewards.map((reward, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'design-choice'; button.setAttribute('role', 'radio');
      const image = document.createElement('img'), label = document.createElement('span');
      const src = designImageUrl(reward); if (src) image.src = src;
      image.alt = ''; image.referrerPolicy = 'no-referrer'; label.textContent = reward.name; button.append(image, label);
      button.addEventListener('click', () => { $('reward').value = reward.id; return selectReward(); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? config.rewards.length - 1 : (index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + config.rewards.length) % config.rewards.length;
        $('reward').value = config.rewards[next].id; $('designs').children[next].focus(); return selectReward();
      });
      return button;
    }));
    updateDesignChoices();
  }
  function personalKey() { return `${storageKey}:personalization:${creatorId}:${sessionId}`; }
  function historyKey() { return `${personalKey()}:history`; }
  function clearViewedDesign() { viewedPersonalId = null; remove(`${historyKey()}:view`); historyReadVersion++; }
  function ownsRecord(record) {
    return record?.input?.creatorId === creatorId && record.input.sessionId === sessionId && record.input.campaignId === campaignId && typeof record.input.sourceDesignId === 'string' && typeof record.input.text === 'string';
  }
  function recordIdentity(record) { return record ? JSON.stringify([record.input.campaignId, record.input.creatorId, record.input.sessionId, record.id || record.input.requestId, record.input.sourceDesignId, record.input.text]) : ''; }
  function selectedPersonalRecord() { return viewedPersonalId ? personalHistory.find(record => record.id === viewedPersonalId) : personalRecord; }
  function personalMatches(record = selectedPersonalRecord()) { return ownsRecord(record) && record.input.sourceDesignId === rewardId && record.input.text === personalization.trim(); }
  function personalizedRecord() {
    const record = selectedPersonalRecord(), state = record?.state;
    return personalMatches(record) && state?.status === 'succeeded' && state.sourceDesignId === rewardId && state.text === personalization.trim() && state.product?.imageUrl && state.product?.providerProductId ? record : null;
  }
  function personalized() { return Boolean(personalizedRecord()); }
  function personalPreviewReady() { const record = personalizedRecord(); return Boolean(record && loadedPreviewUrl === designImageUrl(record.state.product) && !$('image').hidden); }
  function personalPending() { return personalRecord && (!personalRecord.state || !['succeeded', 'failed'].includes(personalRecord.state.status)); }
  function personalElapsed(record = personalRecord) {
    if (!Number.isFinite(record?.startedAt)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - record.startedAt) / 1000));
    return ` Elapsed: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.`;
  }
  function saveHistory() { write(historyKey(), JSON.stringify(personalHistory)); }
  function keepHistory(record) {
    if (!record?.id || !ownsRecord(record)) return;
    const index = personalHistory.findIndex(item => item.id === record.id);
    const existing = personalHistory[index];
    if (existing?.state && record.state && ((['succeeded', 'failed'].includes(existing.state.status) && !['succeeded', 'failed'].includes(record.state.status)) || (existing.state.status === 'succeeded' && record.state.status !== 'succeeded') || (existing.state.stage === 'product' && record.state.stage === 'refine' && !['succeeded', 'failed'].includes(record.state.status)))) record = existing;
    if (index < 0) personalHistory.unshift({...record}); else personalHistory[index] = {...record};
    personalHistory.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    saveHistory();
    return personalHistory.find(item => item.id === record.id);
  }
  function fromHistoryState(state) {
    if (!state?.personalizationId || typeof state.sourceDesignId !== 'string' || typeof state.text !== 'string') return null;
    const existing = personalHistory.find(item => item.id === state.personalizationId);
    return {id:state.personalizationId, input:{campaignId, creatorId, sessionId, sourceDesignId:state.sourceDesignId, text:state.text, ...(existing?.input.requestId ? {requestId:existing.input.requestId} : {})}, startedAt:existing?.startedAt ?? Date.parse(state.createdAt), state};
  }
  async function loadPersonalHistory() {
    if (!creatorId) return;
    try {
      const saved = JSON.parse(read(historyKey()) || '[]');
      for (const record of Array.isArray(saved) ? saved : []) if (ownsRecord(record) && record.id && !personalHistory.some(item => item.id === record.id)) personalHistory.push({...record, state:null});
      const response = await api(`customer-personalizations?sessionId=${encodeURIComponent(sessionId)}&campaignId=${encodeURIComponent(campaignId)}`);
      if (!Array.isArray(response.items)) throw new Error('Saved designs could not be read.');
      for (const state of response.items.slice().reverse()) { const record = fromHistoryState(state); if (record) keepHistory(record); }
      if (!personalRecord) {
        const pending = personalHistory.find(record => record.state && !['succeeded', 'failed'].includes(record.state.status));
        if (pending) { personalRecord = {...pending}; savePersonalRecord(); showRecord(personalRecord); }
      }
      const savedView = read(`${historyKey()}:view`);
      if (savedView && personalHistory.some(record => record.id === savedView && record.state?.status === 'succeeded')) await viewSavedDesign(savedView);
      drawHistory(); updatePersonalControls();
    } catch { drawHistory(); }
  }
  function drawHistory() {
    const records = personalHistory.filter(record => record.state?.status === 'succeeded');
    const version = JSON.stringify([viewedPersonalId, records.map(record => [record.id, record.input.text, record.state.product?.imageUrl])]);
    if (version === historyVersion) return;
    historyVersion = version; $('history-label').hidden = !records.length;
    $('personal-history').replaceChildren(...records.map(record => {
      const button = document.createElement('button'), image = document.createElement('img'), label = document.createElement('span');
      button.type = 'button'; button.className = 'design-choice'; button.setAttribute('aria-pressed', String(viewedPersonalId === record.id));
      const url = designImageUrl(record.state.product); if (url) image.src = url;
      image.alt = ''; image.referrerPolicy = 'no-referrer'; label.textContent = record.input.text + ' · Ready'; button.append(image, label);
      button.addEventListener('click', () => viewSavedDesign(record.id));
      return button;
    }));
  }
  function showRecord(record) {
    if (!ownsRecord(record)) return;
    card.scrollTop = 0; rewardId = record.input.sourceDesignId; $('reward').value = rewardId;
    $('personal-options').open = true;
    personalization = record.input.text; $('personal').value = personalization; $('count').textContent = `${[...personalization].length} / 32`;
    drawImage(); updatePersonalControls();
  }
  async function viewSavedDesign(id) {
    const record = personalHistory.find(item => item.id === id); if (!record) return;
    const version = ++historyReadVersion;
    chooseReward(true); viewedPersonalId = id; write(`${historyKey()}:view`, id); showRecord(record);
    try {
      const state = await api(`customer-personalizations/${encodeURIComponent(id)}?sessionId=${encodeURIComponent(sessionId)}`);
      if (state.personalizationId !== id || state.sourceDesignId !== record.input.sourceDesignId || state.text !== record.input.text) throw new Error('The saved design did not match.');
      keepHistory({...record, state});
      if (version !== historyReadVersion || viewedPersonalId !== id) return;
      drawImage(); updatePersonalControls(); await refreshQuote();
    } catch (error) { if (version === historyReadVersion) { clearViewedDesign(); status('Could not open the saved design: ' + error.message, true); drawImage(); updatePersonalControls(); } }
  }
  function currentRequestMessage() {
    const state = personalRecord?.state, text = personalRecord?.input.text;
    if (personalBusy) return 'Submitting your request to Arcade…';
    if (personalRecord?.admissionError) return 'Generation did not start. ' + personalRecord.admissionError.message;
    if (state?.status === 'unknown') return 'Generation could not be confirmed. The demo operator must check it before another attempt.';
    if (state?.status === 'failed') return state.error?.message || 'Arcade could not create this design. Your earlier designs are still saved.';
    if (['timed_out', 'awaiting_resume', 'awaiting_product'].includes(state?.status)) return `Your ${text} request is saved. Continue the same generation.`;
    if (personalError) return personalError;
    if (personalRecord && !personalRecord.id) return 'Generation has not been confirmed. Try generating again to send the same saved request.';
    if (personalActive.has(state?.status)) return (state.stage === 'product' ? `Arcade is rendering your product preview · ${text}…` : `Arcade is composing your personalized pattern · ${text}…`) + ' This can take several minutes.' + personalElapsed();
    if (state?.status === 'succeeded') return `Your ${text} design is ready.`;
    return '';
  }
  function getView() {
    const visible = Boolean(creatorId && config?.creator.id === creatorId), declined = read(dismissalKey()) === '1';
    const selected = personalizedRecord(), source = config?.rewards.find(reward => reward.id === rewardId);
    const image = selected?.state.product || source;
    const pending = Boolean(personalBusy || personalActive.has(personalRecord?.state?.status));
    return {visible, creatorName:config?.creator.name || '', creatorId:visible ? creatorId : null, currency:config?.currency || 'USD', rewardId:rewardId || null,
      rewardName:source?.name || selected?.state.product.name || 'Creator design', imageUrl:image ? designImageUrl(image) : null,
      personalizationText:selected?.input.text || null, previewReady:selected ? personalPreviewReady() : Boolean(loadedPreviewUrl && !$('image').hidden),
      personalizationStatus:selected ? 'succeeded' : personalMatches(personalRecord) ? personalRecord?.state?.status || (personalRecord?.admissionError ? 'not_started' : 'unconfirmed') : personalization ? 'draft' : 'original',
      pending, pendingText:pending ? personalRecord?.input.text : null, progressMessage:currentRequestMessage(),
      eligible:Boolean(visible && quote?.eligible), fanCopay:visible && quote?.eligible ? quote.fanCopay : null, selected:Boolean(visible && rewardChosen && !declined), declined};
  }
  function updatePersonalControls() {
    const source = config?.rewards.find(reward => reward.id === rewardId);
    const valid = personalization.trim() && [...personalization].length <= 32 && /^[\p{L}\p{N} .,'’\-]+$/u.test(personalization);
    $('generate').disabled = config?.customerPersonalizationEnabled !== true || !creatorId || source?.imageSource !== 'arcade' || !valid || personalBusy || Boolean(personalPending()) || personalized();
    const state = personalRecord?.state, current = currentRequestMessage();
    const finalLoading = Boolean(!viewedPersonalId && personalMatches(personalRecord) && personalized() && !personalPreviewReady() && failedPreviewUrl !== designImageUrl(personalRecord.state.product));
    const generating = personalBusy || personalActive.has(state?.status) || finalLoading;
    const showArtProgress = !viewedPersonalId && generating;
    $('preview').disabled = showArtProgress || $('image').hidden || !loadedPreviewUrl;
    $('preview').setAttribute('aria-busy', String(showArtProgress)); $('generation-status').hidden = !showArtProgress;
    if (showArtProgress) $('generation-status').textContent = finalLoading ? 'Loading your final design…' : !personalRecord?.id ? 'Submitting your request to Arcade…' : (state?.stage === 'product' ? `Rendering your product preview · ${personalRecord.input.text}.` : `Creating your ${personalRecord.input.text} pattern.`) + ' This can take several minutes.' + personalElapsed();
    $('request-progress').hidden = !personalRecord;
    $('request-progress').textContent = finalLoading ? 'Your design is ready. Loading the final image…' : current;
    $('view-current').hidden = !personalRecord;
    $('view-current').textContent = state?.status === 'succeeded' ? `View new design · ${personalRecord.input.text}` : `View current request · ${personalRecord?.input.text || ''}`;
    const resumable = ['timed_out', 'awaiting_resume', 'awaiting_product'].includes(state?.status);
    $('recover').hidden = !personalRecord || (!resumable && !personalActive.has(state?.status) && Boolean(personalRecord.id) && Boolean(state));
    $('recover').disabled = personalBusy || !creatorId || Boolean((resumable || !personalRecord?.id) && config?.customerPersonalizationEnabled !== true);
    $('recover').textContent = resumable ? 'Continue generation' : personalRecord?.id ? 'Check progress' : 'Try generating again';
    $('simulate').disabled = busy || personalBusy || !creatorId || !quote?.eligible || Boolean(personalization && (!personalized() || !personalPreviewReady()));
    $('personal-status').textContent = viewedPersonalId && personalized() ? `Viewing your saved ${personalization} design. Your latest request remains available above.` : current || (config?.customerPersonalizationEnabled !== true ? 'Arcade personalization is temporarily unavailable. Your creator original is still available.' : source?.imageSource === 'arcade' ? 'Add a place or year, then generate your design with Arcade.' : 'Choose the Arcade creator design to personalize it.');
    $('choose').disabled = !creatorId || !source || personalBusy || Boolean(personalization && (!personalized() || !personalPreviewReady()));
    updateDesignChoices(); drawHistory();
    window.dispatchEvent(new CustomEvent('creator-rewards:view', {detail:getView()}));
  }
  function savePersonalRecord() {
    const value = JSON.stringify(personalRecord); write(personalKey(), value);
    if (read(personalKey()) !== value) throw new Error('Browser storage is unavailable. Enable it before starting a generation.');
  }
  function acceptPersonalState(state, target) {
    if (!target || !state?.personalizationId || (target.id && state.personalizationId !== target.id) || state.sourceDesignId !== target.input.sourceDesignId || state.text !== target.input.text) throw new Error('Arcade returned a result for a different request.');
    let accepted = {...target, id:state.personalizationId, state}; delete accepted.admissionError;
    accepted = keepHistory(accepted) || accepted;
    if (recordIdentity(personalRecord) !== recordIdentity(target)) return;
    personalRecord = accepted; personalError = ''; savePersonalRecord(); drawImage(); updatePersonalControls();
  }
  async function readPersonalization() {
    if (!personalRecord?.id || personalPollBusy || personalBusy) return;
    const target = personalRecord;
    personalPollBusy = true;
    try { acceptPersonalState(await api(`customer-personalizations/${encodeURIComponent(target.id)}?sessionId=${encodeURIComponent(sessionId)}`), target); }
    catch (error) { if (recordIdentity(target) === recordIdentity(personalRecord)) { personalError = 'Could not check your saved design: ' + error.message; updatePersonalControls(); $('simulate').disabled = true; } }
    finally { personalPollBusy = false; }
  }
  async function restorePersonalization() {
    if (!creatorId) return;
    try {
      const record = JSON.parse(read(personalKey()) || 'null');
      if (!ownsRecord(record) || (typeof record.input.requestId !== 'string' && !record.id)) return;
      personalRecord = {...record, state:null}; viewedPersonalId = null; showRecord(personalRecord);
      if (personalRecord.id) await readPersonalization();
    } catch (error) { $('personal-status').textContent = 'Could not restore your saved request: ' + error.message; $('generate').disabled = true; }
  }
  async function submitPersonalRequest(resume = false) {
    if (personalBusy || !personalRecord || !creatorId || personalRecord.state?.status === 'unknown' || (!resume && !personalRecord.input.requestId)) return;
    if (personalRecord.admissionError) { delete personalRecord.admissionError; personalRecord.startedAt = Date.now(); }
    const target = personalRecord;
    personalBusy = true; personalError = ''; updatePersonalControls();
    try {
      savePersonalRecord();
      const path = resume ? `customer-personalizations/${encodeURIComponent(target.id)}/resume` : 'customer-personalizations';
      acceptPersonalState(await api(path, resume ? {sessionId} : target.input), target);
    } catch (error) {
      if (recordIdentity(target) !== recordIdentity(personalRecord)) return;
      if (!target.id && error.httpStatus >= 400 && error.httpStatus < 500 && ['invalid_text', 'invalid_source', 'invalid_input'].includes(error.code)) { remove(personalKey()); personalRecord = null; personalError = error.message; }
      else if (!target.id && error.httpStatus >= 400 && error.httpStatus < 500 && ['customer_personalization_limit', 'personalization_limit', 'personalization_busy'].includes(error.code)) { personalRecord.admissionError = {code:error.code, message:error.message}; savePersonalRecord(); }
      else personalError = error.message + (target.id ? ' Your request is saved.' : ' Try again with the same saved request when ready.');
    } finally { personalBusy = false; updatePersonalControls(); }
  }
  async function generatePersonalization() {
    await ready; updatePersonalControls(); if ($('generate').disabled) return;
    keepHistory(personalRecord); chooseReward(true); clearViewedDesign(); card.scrollTop = 0;
    personalRecord = {input:{campaignId, creatorId, sessionId, sourceDesignId:rewardId, text:personalization.trim(), requestId:crypto.randomUUID()}, startedAt:Date.now(), id:null, state:null};
    drawImage(); await submitPersonalRequest();
  }
  async function recoverPersonalization() {
    await ready; if (!personalRecord || personalBusy || personalRecord.state?.status === 'unknown') return;
    clearViewedDesign(); showRecord(personalRecord);
    if (!personalRecord.id) return submitPersonalRequest();
    if (!personalRecord.state || personalActive.has(personalRecord.state.status)) return readPersonalization();
    if (['timed_out', 'awaiting_resume', 'awaiting_product'].includes(personalRecord.state.status)) return submitPersonalRequest(true);
  }
  const personalPoll = setInterval(async () => {
    if (!host.isConnected) { clearInterval(personalPoll); return; }
    if (document.hidden || !personalRecord?.id || !personalActive.has(personalRecord.state?.status)) return;
    updatePersonalControls();
    await readPersonalization();
  }, 2500);
  async function retryConfig() {
    const pending = loadConfig(); window.CreatorRewards.ready = pending;
    const loaded = await pending;
    if (loaded) window.dispatchEvent(new CustomEvent('creator-rewards:config', {detail:loaded}));
    return loaded;
  }
  $('retry-load').addEventListener('click', retryConfig);
  $('reward').addEventListener('change', selectReward);
  $('choose').addEventListener('click', confirmReward);
  $('personal').addEventListener('input', () => { clearViewedDesign(); personalization = Array.from($('personal').value.replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, 32).join(''); $('personal').value = personalization; drawImage(); updatePersonalControls(); $('count').textContent = `${Array.from(personalization).length} / 32`; });
  $('view-current').addEventListener('click', async () => { clearViewedDesign(); showRecord(personalRecord); if (personalRecord?.id) await readPersonalization(); await refreshQuote(); });
  $('generate').addEventListener('click', generatePersonalization);
  $('recover').addEventListener('click', recoverPersonalization);
  $('simulate').addEventListener('click', simulate);
  $('preview').addEventListener('click', openPreview);
  $('close-preview').addEventListener('click', () => $('preview-dialog').close());
  $('preview-dialog').addEventListener('click', event => {
    if (event.target !== $('preview-dialog')) return;
    const bounds = $('preview-dialog').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('preview-dialog').close();
  });
  $('preview-dialog').addEventListener('close', () => $('preview').focus());
  $('decline').addEventListener('click', () => setOfferDeclined(true, true));
  $('reopen').addEventListener('click', () => setOfferDeclined(false, true));
  shadow.querySelector('.launcher').onclick = () => { if (card.hidden) setOfferDeclined(false, true); else setOfferDeclined(true, true); };
  shadow.querySelector('.close').onclick = () => setOfferDeclined(true, true);
  window.CreatorRewards = { ready, setBasket, getAttribution: () => ({ creatorId: creatorId || null }), getView, retry:retryConfig, open: (options = {}) => setOfferDeclined(false, options.focus !== false), simulate };
  let pollBusy = false, connectionFailed = false;
  const poll = setInterval(async () => {
    if (!host.isConnected) { clearInterval(poll); return; }
    if (!config || pollBusy || document.hidden) return;
    pollBusy = true;
    try {
      const updated = await api(`public?campaign=${encodeURIComponent(campaignId)}`);
      if (connectionFailed || JSON.stringify(updated) !== JSON.stringify(config)) {
        connectionFailed = false;
        config = updated; revalidateReferral(); drawConfig(); await refreshQuote();
        window.dispatchEvent(new CustomEvent('creator-rewards:config', { detail: config }));
        status(creatorId ? 'Campaign updated live. Your benefit has been recalculated.' : 'The creator link is no longer valid. Open the current creator link to join this campaign.');
      }
    } catch { connectionFailed = true; status('Connection interrupted. Your displayed benefit may be out of date.', true); $('simulate').disabled = true; }
    finally { pollBusy = false; }
  }, 3000);
})();
