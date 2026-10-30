/**
 * TanStack Query 캐시의 기기 사본(`query_cache`)을 읽고 쓰는 자리. 저장기가 `getItem` · `setItem` · `removeItem` 으로 부른다.
 */
import { getBossProfitDb } from './sqlite/db'

export async function getQueryCache(key: string): Promise<string | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT value FROM query_cache WHERE key = ?', [key])
  const value = values?.[0]?.value
  return typeof value === 'string' ? value : null
}

export async function setQueryCache(key: string, value: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    'INSERT INTO query_cache (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}

export async function removeQueryCache(key: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run('DELETE FROM query_cache WHERE key = ?', [key])
}
