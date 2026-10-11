import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function sqliteD1(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../drizzle/0000_hosted_demo.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const adapter={prepare(sql){let args=[];const api={bind(...values){args=values;return api},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)},success:true}}};return api},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}},close(){db.close()}};
 return adapter;
}
