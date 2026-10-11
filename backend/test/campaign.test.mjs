import test from 'node:test';
import assert from 'node:assert/strict';
import { campaign, calculate, quote } from '../campaign.mjs';

test('small and large quotes use the server fixture and integer USD amounts', () => {
  for (const [scenarioId, subsidy, copay, before, budget] of [
    ['small', 8000, 6000, 46000, 16000],
    ['large', 14000, 0, 52000, 22000],
  ]) {
    const value = quote({ campaignId: campaign.id, productId: 'coastal-pillow', scenarioId });
    assert.equal(value.merchantSubsidy, subsidy);
    assert.equal(value.fanCopay, copay);
    assert.equal(value.orderContributionBefore, before);
    assert.equal(value.campaignBudget, budget);
    assert.equal(value.creatorCommission, 6000);
    assert.equal(value.platformFee, 2000);
    assert.equal(value.productCost, 14000);
    assert.equal(value.merchantContributionAfter, 30000);
    assert.equal(value.currency, 'USD');
    assert.equal(value.pricingSource, 'demo_fixture');
  }
});

test('unknown IDs and client-supplied prices are rejected', () => {
  const valid = { campaignId: campaign.id, productId: 'coastal-pillow', scenarioId: 'small' };
  for (const key of Object.keys(valid)) assert.throws(() => quote({ ...valid, [key]: 'unknown' }));
  assert.throws(() => quote({ ...valid, productCost: 1 }));
});

test('invalid money and impossible budgets are rejected', () => {
  const valid = { orderContributionBefore: 46000, campaignBudget: 16000, creatorCommission: 6000, platformFee: 2000, productCost: 14000 };
  for (const bad of [NaN, Infinity, -1, 0.5, '16000', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculate({ ...valid, campaignBudget: bad }));
  }
  assert.throws(() => calculate({ ...valid, campaignBudget: 7000 }));
  assert.throws(() => calculate({ ...valid, orderContributionBefore: 0 }));
});

test('illustration does not claim provider provenance', () => {
  const product = campaign.collection.products[0];
  assert.equal(product.imageSource, 'illustration');
  for (const field of ['providerProductId', 'providerPatternId', 'providerJobId', 'generatedAt']) assert.equal(product[field], null);
});
