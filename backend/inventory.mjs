// Read-only provider discovery. No patterns/create or products/create calls.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Arcade } from './arcade.mjs';

try {
  const adapter = new Arcade({ key: process.env.ARCADE_API_KEY, userAgent: process.env.ARCADE_USER_AGENT });
  const category = await adapter.demoCategory(process.env.ARCADE_CATEGORY_ID || undefined);
  const products = await adapter.listProducts();
  mkdirSync('data', { recursive: true, mode: 0o700 });
  writeFileSync('data/arcade-inventory.json', JSON.stringify({ verifiedAt: new Date().toISOString(), category, products }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ categoryId: category.categoryId, name: category.name, selections: category.selections,
    products: products.items.map(item => ({ productId: item.productId, patternId: item.patternId, title: item.title, categoryId: item.categoryId })),
    hasMoreProducts: Boolean(products.nextCursor), generationStarted: false }, null, 2));
} catch (error) { console.error(error.code ? `${error.code}: ${error.message}` : 'Read-only inventory failed'); process.exitCode = 1; }
