import { ApiError } from './errors.mjs';

export class CreatorCollection {
  constructor({ store, products }) {
    this.store = store; this.products = products;
    store.db.exec(`CREATE TABLE IF NOT EXISTS creator_collection_archives (
      product_id TEXT PRIMARY KEY, archived INTEGER NOT NULL CHECK (archived IN (0,1))
    );`);
  }
  archivedIds() {
    return new Set(this.store.db.prepare('SELECT product_id FROM creator_collection_archives WHERE archived=1').all().map(row => row.product_id));
  }
  items() {
    const archived = this.archivedIds();
    return this.products().map(product => ({ ...product, archived: archived.has(product.id) }));
  }
  published() {
    const archived = this.archivedIds();
    return this.products().filter(product => !archived.has(product.id));
  }
  setArchived(productId, archived) {
    return this.store.transaction(() => {
      if (!this.products().some(product => product.id === productId)) throw new ApiError(404, 'unknown_product', 'Unknown collection product');
      this.store.db.prepare(`INSERT INTO creator_collection_archives (product_id,archived) VALUES (?,?)
        ON CONFLICT(product_id) DO UPDATE SET archived=excluded.archived`).run(productId, archived ? 1 : 0);
      return { productId, archived: Boolean(archived) };
    });
  }
}
