import { ApiError, exactObject, textField } from './errors.mjs';
const fail=(message,status=400,code='invalid_input')=>{throw new ApiError(status,code,message)};
function id(value, label = 'ID') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) fail(`Invalid ${label}`);
  return value;
}
function money(value) { if (!Number.isSafeInteger(value) || value < 0 || value > 1e9) fail('Money must be integer cents between 0 and 1000000000'); return value; }
export function configInput(value) {
  exactObject(value, ['id', 'shopName', 'shopUrl', 'currency', 'creator', 'products', 'economics'], ['revision']);
  if (value.id !== 'main' || value.currency !== 'USD') fail('Only campaign main and currency USD are supported');
  let url; try { url = new URL(value.shopUrl); } catch { fail('Invalid shop URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || /^[0-9.]+$/.test(url.hostname) || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname) || /\.(local|localhost|internal|test|invalid)$/i.test(url.hostname)) fail('Use an HTTPS public shop hostname without credentials or a custom port');
  exactObject(value.creator, ['id', 'name']);
  if (!Array.isArray(value.products) || !value.products.length || value.products.length > 20) fail('Use 1–20 products');
  const seen = new Set();
  const products = value.products.map(product => {
    exactObject(product, ['id', 'name', 'price', 'cost']); id(product.id);
    if (seen.has(product.id)) fail('Duplicate product ID'); seen.add(product.id);
    return { id: product.id, name: textField(product.name, 'product name', 100), price: money(product.price), cost: money(product.cost) };
  });
  exactObject(value.economics, ['minRetained', 'campaignCap', 'creatorCommission', 'platformFee', 'rewardCost']);
  return { id: 'main', shopName: textField(value.shopName, 'shop name', 100), shopUrl: url.href, currency: 'USD',
    creator: { id: id(value.creator.id), name: textField(value.creator.name, 'creator name', 100) }, products,
    economics: Object.fromEntries(Object.entries(value.economics).map(([key, amount]) => [key, money(amount)])) };
}
export function cart(value, config) {
  if (!Array.isArray(value) || value.length > 10) fail('Use at most ten cart entries');
  const seen = new Set();
  return value.map(item => {
    exactObject(item, ['productId', 'quantity']);
    if (!config.products.some(product => product.id === item.productId) || seen.has(item.productId)) fail('Unknown or duplicate product');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) fail('Quantity must be 1–10');
    seen.add(item.productId); return { productId: item.productId, quantity: item.quantity };
  });
}
export function calculate(items, config) {
  let basketTotal = 0, margin = 0;
  for (const item of items) { const p = config.products.find(p => p.id === item.productId); basketTotal += p.price * item.quantity; margin += (p.price - p.cost) * item.quantity; }
  const e = config.economics, available = Math.max(0, Math.min(e.campaignCap, margin - e.minRetained));
  const eligible = items.length > 0 && margin >= e.minRetained && e.creatorCommission + e.platformFee <= available;
  const creatorCommission = eligible ? e.creatorCommission : 0, platformFee = eligible ? e.platformFee : 0;
  const merchantSubsidy = eligible ? Math.min(e.rewardCost, available - creatorCommission - platformFee) : 0;
  return { eligible, ...(eligible ? {} : { reason: 'insufficient_margin' }), basketTotal, orderContributionBefore: margin,
    campaignBudget: available, creatorCommission, platformFee, productCost: e.rewardCost, merchantSubsidy, fanCopay: e.rewardCost - merchantSubsidy,
    merchantContributionAfter: margin - creatorCommission - platformFee - merchantSubsidy, currency: 'USD', pricingSource: 'merchant_model' };
}
export function publicQuote(value) {
  const { orderContributionBefore, merchantContributionAfter, campaignBudget, creatorCommission, platformFee, ...visible } = value;
  return visible;
}
