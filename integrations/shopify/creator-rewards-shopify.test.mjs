import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCart, basketFingerprint } from './creator-rewards-shopify.js';
const config = { currency: 'USD', products: [{ id: 'weekend', price: 99900 }, { id: 'adventure', price: 129900 }] };
const mapping = { variants: { '11': 'weekend' }, products: { '200': 'adventure' } };
const line = (variant_id = 11, product_id = 100, quantity = 1, price = 99900) => ({ variant_id, product_id, quantity, final_line_price: price * quantity });
const cart = items => ({ currency: 'USD', items, total_discount: 0, total_price: items.reduce((sum, item) => sum + item.final_line_price, 0) });
test('maps variants before products and merges split Shopify lines', () => {
  assert.deepEqual(mapCart(cart([line(), line(), line(22, 200, 1, 129900)]), mapping, config), { items: [{ productId: 'adventure', quantity: 1 }, { productId: 'weekend', quantity: 2 }], error: null });
});
test('unknown product blocks the whole cart rather than inflating model benefit', () => {
  const result = mapCart(cart([line(), line(99, 999)]), mapping, config);
  assert.deepEqual(result.items, []); assert.match(result.error, /mapped/);
});
test('rejects discounted prices, non-USD, subscriptions and quantity outside backend limits', () => {
  for (const value of [cart([line(11, 100, 1, 99000)]), { ...cart([line()]), currency: 'CZK' }, cart([{ ...line(), selling_plan_allocation: {} }]), cart([line(11, 100, 11)]), { ...cart([line()]), total_price: 1 }]) {
    assert.ok(mapCart(value, mapping, config).error); assert.deepEqual(mapCart(value, mapping, config).items, []);
  }
});
test('mapping to nonexistent configured product is not accepted', () => {
  assert.match(mapCart(cart([line()]), { variants: { '11': 'deleted' } }, config).error, /configured/);
});
test('stable fingerprints suppress duplicate poll events regardless of order', () => {
  const a = [{ productId: 'weekend', quantity: 1 }, { productId: 'adventure', quantity: 2 }];
  assert.equal(basketFingerprint(a), basketFingerprint([...a].reverse()));
  assert.notEqual(basketFingerprint(a), basketFingerprint([{ productId: 'weekend', quantity: 2 }]));
});
test('empty cart is valid and clears a previously eligible basket', () => {
  assert.deepEqual(mapCart(cart([]), mapping, config), { items: [], error: null });
});
