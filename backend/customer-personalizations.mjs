import { ApiError, exactObject } from './errors.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const prefix = '/api/growth/customer-personalizations';
function validUuid(value) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new ApiError(400, 'invalid_input', 'A UUID is required');
  return value;
}
export function customerRoute(path) {
  if (path === prefix) return { action: 'create' };
  const match = /^\/api\/growth\/customer-personalizations\/([^/]+)(\/resume)?$/.exec(path);
  return match && uuid.test(match[1]) ? { action: match[2] ? 'resume' : 'read', id: match[1] } : null;
}
export function createCustomerPersonalizations({ personalizations, products, enabled }) {
  function enabledForCreate() {
    if (!enabled || !personalizations?.generationEnabled) throw new ApiError(403, 'customer_personalization_disabled', 'Customer generation is disabled');
  }
  function owned(personalizationId, sessionId) {
    validUuid(personalizationId); validUuid(sessionId);
    const row = personalizations?.row(personalizationId);
    if (!row?.customer || row.customer.sessionId !== sessionId) throw new ApiError(404, 'unknown_personalization', 'Unknown personalization');
    return row;
  }
  return {
    available: () => enabled === true && personalizations?.generationEnabled === true,
    list(url, config) {
      if ([...url.searchParams.keys()].some(key => !['sessionId', 'campaignId'].includes(key))
        || url.searchParams.getAll('sessionId').length !== 1 || url.searchParams.getAll('campaignId').length !== 1
        || url.searchParams.get('campaignId') !== config.id) throw new ApiError(400, 'invalid_input', 'Use one visitor sessionId and the configured campaignId');
      const sessionId = validUuid(url.searchParams.get('sessionId'));
      const items = (personalizations?.rows() ?? [])
        .filter(row => row.customer?.sessionId === sessionId && row.customer.campaignId === config.id)
        .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
        .map(row => ({ ...personalizations.get(row.id), createdAt: typeof row.createdAt === 'string' ? row.createdAt : null }));
      return { items };
    },
    create(value, config) {
      enabledForCreate();
      exactObject(value, ['campaignId', 'creatorId', 'sessionId', 'sourceDesignId', 'text', 'requestId']);
      validUuid(value.sessionId); validUuid(value.requestId);
      if (value.campaignId !== config.id || value.creatorId !== config.creator.id) throw new ApiError(400, 'invalid_input', 'Unknown campaign or creator');
      if (!products().some(p => p.id === value.sourceDesignId && p.imageSource === 'arcade')) throw new ApiError(400, 'invalid_source', 'Choose a published Arcade creator design');
      return personalizations.create({ sourceDesignId: value.sourceDesignId, text: value.text, requestId: `customer:${value.sessionId}:${value.requestId}` },
        { authorized: true, customer: { sessionId: value.sessionId, campaignId: value.campaignId, creatorId: value.creatorId } });
    },
    get(personalizationId, url) {
      if ([...url.searchParams.keys()].some(key => key !== 'sessionId') || url.searchParams.getAll('sessionId').length !== 1) throw new ApiError(400, 'invalid_input', 'Use one visitor sessionId');
      owned(personalizationId, url.searchParams.get('sessionId'));
      return personalizations.get(personalizationId);
    },
    resume(personalizationId, value) {
      enabledForCreate(); exactObject(value, ['sessionId']); owned(personalizationId, value.sessionId);
      return personalizations.resume(personalizationId, { authorized: true });
    },
    validateEvent(value) {
      const row = owned(value.personalizationId, value.sessionId);
      if (!['reward_selected', 'checkout_simulated'].includes(value.type) || row.status !== 'succeeded' || !row.product || row.customer.campaignId !== value.campaignId || row.customer.creatorId !== value.creatorId || row.input.sourceDesignId !== value.rewardId || row.input.text !== value.personalization?.text) throw new ApiError(400, 'invalid_personalization', 'Use your completed variant with matching design and text');
      return row.product;
    },
  };
}
