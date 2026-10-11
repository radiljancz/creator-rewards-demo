import { ApiError, exactObject } from './errors.mjs';

export const illustration = Object.freeze({
  id: 'coastal-pillow', name: 'Coastal trails — concept pillow',
  imageUrl: '/assets/coastal-pillow.svg', imageSource: 'illustration',
  providerProductId: null, providerPatternId: null, providerJobId: null, generatedAt: null,
});

const scenarios = {
  small: { id: 'small', name: 'Smaller basket', orderContributionBefore: 46000, campaignBudget: 16000, creatorCommission: 6000, platformFee: 2000, productCost: 14000 },
  large: { id: 'large', name: 'Larger basket', orderContributionBefore: 52000, campaignBudget: 22000, creatorCommission: 6000, platformFee: 2000, productCost: 14000 },
};

export const campaign = {
  id: 'creator-rewards-demo', demo: true, currency: 'USD',
  creator: { id: 'demo-creator', name: 'Alex — outdoor creator', fictional: true, demoLink: '/?creator=demo-creator' },
  merchant: { id: 'demo-store', name: 'Outdoor demo store', simulated: true },
  collection: { id: 'coastal-trails', name: 'Coastal trails', products: [illustration] },
  scenarios: Object.values(scenarios).map(scenario => ({ ...scenario, ...calculate(scenario) })),
};

export function calculate(inputs) {
  const fields = ['orderContributionBefore', 'campaignBudget', 'creatorCommission', 'platformFee', 'productCost'];
  for (const key of fields) if (!Number.isSafeInteger(inputs[key]) || inputs[key] < 0) throw new ApiError(400, 'invalid_money', `Invalid ${key}`);
  const { orderContributionBefore, campaignBudget, creatorCommission, platformFee, productCost } = inputs;
  const fixed = creatorCommission + platformFee;
  if (!Number.isSafeInteger(fixed) || fixed > campaignBudget) throw new ApiError(400, 'invalid_budget', 'Budget cannot cover commission and fee');
  const merchantSubsidy = Math.min(productCost, campaignBudget - fixed);
  const spent = fixed + merchantSubsidy;
  if (!Number.isSafeInteger(spent) || spent > orderContributionBefore) throw new ApiError(400, 'invalid_contribution', 'Campaign exceeds order contribution');
  return { orderContributionBefore, campaignBudget, creatorCommission, platformFee, productCost,
    merchantSubsidy, fanCopay: productCost - merchantSubsidy, merchantContributionAfter: orderContributionBefore - spent,
    currency: 'USD', pricingSource: 'demo_fixture' };
}

export function quote(input, products = campaign.collection.products) {
  exactObject(input, ['campaignId', 'productId', 'scenarioId']);
  if (input.campaignId !== campaign.id || !products.some(product => product.id === input.productId) || !Object.hasOwn(scenarios, input.scenarioId)) {
    throw new ApiError(404, 'unknown_id', 'Unknown campaign, product or scenario');
  }
  return { ...input, ...calculate(scenarios[input.scenarioId]), demo: true };
}
