import { ApiError } from './errors.mjs';

function completeCategory(category, categoryId) {
  return category?.categoryId === categoryId && category.world === 'print' && category.canManufacture === true && category.available !== false
    && category.selections && typeof category.selections === 'object' && !Array.isArray(category.selections) && Array.isArray(category.options)
    && category.options.every(option => option && typeof option.key === 'string' && Array.isArray(option.values)
      && option.values.some(value => value && value.available === true && value.value === category.selections[option.key]));
}

export class Arcade {
  constructor({ key, userAgent = 'CreatorRewardsDemo/0.1 (operator: Radek Jancar)', transport = fetch, requestTimeoutMs = 180000 }) {
    if (!key) throw new ApiError(503, 'missing_key', 'ARCADE_API_KEY is required for live mode');
    Object.assign(this, { key, userAgent, transport, requestTimeoutMs });
  }
  async call(operation, body) {
    let response;
    try {
      response = await this.transport(`https://platform.arcade.ai/v1/${operation}`, {
        method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', 'User-Agent': this.userAgent },
        body: JSON.stringify(body), signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch { throw new ApiError(502, 'provider_unavailable', 'Arcade request did not return a response'); }
    if (!response.ok) {
      const error = new ApiError(502, 'provider_http_error', `Arcade returned HTTP ${response.status}`);
      error.providerStatus = response.status; throw error;
    }
    try { return await response.json(); }
    catch { throw new ApiError(502, 'invalid_provider_result', 'Arcade did not return JSON'); }
  }
  startPattern(body) { return this.call('patterns/create', body); }
  startProduct(body) { return this.call('products/create', body); }
  getJob(jobId) { return this.call('jobs/get', { jobId }); }
  getProduct(productId) { return this.call('products/get', { productId, quantity: 1 }); }
  listProducts(cursor = null) { return this.call('products/list', { limit: 100, ...(cursor ? { cursor } : {}) }); }
  categories() { return this.call('categories/list', {}); }
  async demoCategories(preferredId) {
    const { items } = await this.categories();
    if (!Array.isArray(items)) throw new ApiError(502, 'invalid_provider_result', 'Missing category inventory');
    const print = items.filter(item => item?.world === 'print' && typeof item.categoryId === 'string' && item.categoryId);
    const pillows = print.filter(item => /pillow|cushion/i.test(item.name));
    if (preferredId && !pillows.some(item => item.categoryId === preferredId)) throw new ApiError(400, 'unsupported_category', 'Choose a supported pillow category');
    const pillowCandidates = preferredId ? pillows.filter(item => item.categoryId === preferredId)
      : [...pillows.filter(item => /outdoor/i.test(item.name)), ...pillows.filter(item => !/outdoor/i.test(item.name))];
    const groups = [pillowCandidates, print.filter(item => /\bscar(?:f|ves)\b/i.test(item.name)), print.filter(item => /\btea\s+towels?\b/i.test(item.name))]
      .map(candidates => candidates.filter(item => item.available !== false));
    const catalog = [];
    for (const candidates of groups) {
      for (const item of candidates) {
        let category;
        try { category = await this.call('categories/get', { categoryId: item.categoryId, selections: {} }); }
        catch { continue; }
        if (!completeCategory(category, item.categoryId)) continue;
        catalog.push({ ...category, name: category.name ?? item.name, imageUrl: category.imageUrl ?? item.imageUrl ?? null });
        break;
      }
    }
    if (!catalog.length) throw new ApiError(400, 'unsupported_category', 'No supported manufacturable textile category found');
    return catalog;
  }
  async demoCategory(preferredId) {
    const { items } = await this.categories();
    if (!Array.isArray(items)) throw new ApiError(502, 'invalid_provider_result', 'Missing category inventory');
    const pillows = items.filter(item => item.world === 'print' && /pillow|cushion/i.test(item.name));
    const chosen = preferredId ? pillows.find(item => item.categoryId === preferredId)
      : pillows.find(item => /outdoor/i.test(item.name)) ?? pillows[0];
    if (!chosen) throw new ApiError(400, 'unsupported_category', 'No supported textile pillow category found');
    const category = await this.call('categories/get', { categoryId: chosen.categoryId, selections: {} });
    if (!completeCategory(category, chosen.categoryId)) {
      throw new ApiError(502, 'invalid_provider_result', 'Category does not provide complete manufacturable selections');
    }
    return category;
  }
}
