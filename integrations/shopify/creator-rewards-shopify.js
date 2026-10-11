/* Shopify-hosted theme bridge. Reads cart only; never modifies checkout or orders. */
export function basketFingerprint(items) {
  return JSON.stringify([...items].sort((a, b) => a.productId.localeCompare(b.productId)));
}
export function mapCart(cart, mapping, config) {
  const invalid = error => ({ items: [], error });
  if (!cart || !Array.isArray(cart.items) || cart.currency !== config.currency || config.currency !== 'USD') return invalid('This demo requires a USD cart.');
  if (cart.total_discount > 0) return invalid('Discounted carts are not supported in this demo.');
  const quantities = new Map(); let expectedTotal = 0;
  for (const line of cart.items) {
    const productId = Object.hasOwn(mapping.variants || {}, String(line.variant_id)) ? mapping.variants[String(line.variant_id)] : mapping.products?.[String(line.product_id)];
    if (!productId) return invalid('Some cart products are not mapped to this campaign.');
    const product = config.products.find(product => product.id === productId);
    if (!product) return invalid('The mapped campaign product is no longer configured.');
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10 || line.selling_plan_allocation) return invalid('This demo supports quantities 1–10 and one-time purchases only.');
    if (!Number.isSafeInteger(line.final_line_price) || line.final_line_price !== product.price * line.quantity) return invalid('Shopify prices differ from the campaign model. Update the model before continuing.');
    const quantity = (quantities.get(productId) || 0) + line.quantity;
    if (quantity > 10) return invalid('This demo supports at most ten units of each campaign product.');
    quantities.set(productId, quantity); expectedTotal += line.final_line_price;
  }
  if (quantities.size > 10 || cart.total_price !== expectedTotal) return invalid('The cart total is outside this demo model.');
  return { items: [...quantities].map(([productId, quantity]) => ({ productId, quantity })).sort((a, b) => a.productId.localeCompare(b.productId)), error: null };
}

async function mount() {
  const node = document.getElementById('creator-rewards-shopify-config');
  if (!node || window.CreatorRewardsShopify) return;
  const message = document.getElementById('creator-rewards-shopify-status');
  const report = (text, error = false) => { if (message) { message.textContent = text; message.dataset.error = String(error); } };
  let settings, service;
  try {
    settings = JSON.parse(node.textContent); service = new URL(settings.backendOrigin);
    if (service.protocol !== 'https:' || service.username || service.password || service.port || service.pathname !== '/' || service.search || service.hash || /localhost|\.invalid$|REPLACE/i.test(service.hostname)) throw new Error();
  } catch { report('Creator Rewards demo needs its HTTPS service URL configured.', true); return; }
  const root = window.Shopify?.routes?.root;
  if (!root || !root.startsWith('/') || root.startsWith('//')) { report('This bridge requires a Shopify-hosted theme.', true); return; }
  report('Connecting Creator Rewards demo…');
  try {
    if (!window.CreatorRewards) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = service.origin + '/rewards.js'; script.dataset.campaign = settings.campaign || 'main';
        script.onload = resolve; script.onerror = () => reject(new Error('The reward service is unavailable.')); document.body.append(script);
      });
    }
    let config = await window.CreatorRewards?.ready;
    if (!config) throw new Error('Reward service connection failed. Reload after the service is available.');
    let busy = false, lastBasket = null;
    async function sync() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const response = await fetch(root + 'cart.js', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Shopify cart is temporarily unavailable.');
        const mapped = mapCart(await response.json(), settings.mapping || {}, config);
        const fingerprint = basketFingerprint(mapped.items);
        if (fingerprint !== lastBasket) { await window.CreatorRewards.setBasket(mapped.items); lastBasket = fingerprint; }
        report(mapped.error || 'Creator Rewards demo: linked to your Shopify cart. Reward checkout is simulated.', Boolean(mapped.error));
      } catch (error) {
        if (lastBasket !== '[]') { await window.CreatorRewards.setBasket([]); lastBasket = '[]'; }
        report(error.message || 'Cart sync unavailable; reward benefit cleared.', true);
      } finally { busy = false; }
    }
    window.CreatorRewardsShopify = { refresh: sync };
    window.addEventListener('creator-rewards:config', event => { config = event.detail; sync(); });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    await sync();
    // Read-only polling works across themes without monkey-patching their fetch/XHR.
    // setBasket is called only when the mapped contents change, never on unchanged polls.
    setInterval(sync, 2000);
  } catch (error) {
    report(error.message || 'Creator Rewards is currently unavailable.', true);
    // The widget can recover its public configuration with a read-only retry.
    window.addEventListener('creator-rewards:config', () => mount(), { once: true });
  }
}
if (typeof document !== 'undefined') mount();
