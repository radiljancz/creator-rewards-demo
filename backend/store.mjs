import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS completions (request_id TEXT PRIMARY KEY, input TEXT NOT NULL, value TEXT NOT NULL);`);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  getDesign(id) { return this.parse(this.db.prepare('SELECT value FROM designs WHERE id=?').get(id)); }
  getDesignRequest(id) { return this.parse(this.db.prepare('SELECT value FROM designs WHERE request_id=?').get(id)); }
  putDesign(value) {
    this.db.prepare('INSERT INTO designs VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(value.id, value.requestId, JSON.stringify(value));
  }
  designs() { return this.db.prepare('SELECT value FROM designs ORDER BY rowid').all().map(row => this.parse(row)); }
  putProduct(value) { this.db.prepare('INSERT INTO products VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(value.id, JSON.stringify(value)); }
  products() { return this.db.prepare('SELECT value FROM products ORDER BY rowid').all().map(row => this.parse(row)); }
  getCompletion(id) {
    const row = this.db.prepare('SELECT input,value FROM completions WHERE request_id=?').get(id);
    return row ? { input: JSON.parse(row.input), value: JSON.parse(row.value) } : null;
  }
  putCompletion(requestId, input, value) { this.db.prepare('INSERT INTO completions VALUES (?,?,?)').run(requestId, JSON.stringify(input), JSON.stringify(value)); }
  parse(row) { return row ? JSON.parse(row.value) : null; }
  close() { this.db.close(); }
}
