/**
 * 우리 서버의 보스 표 조회. `settlement.ts` 와 같은 자리, 같은 규칙이다.
 *
 * **못 받았으면 표를 바꾸지 않는다.** 실패가 어떤 모양이든 밖으로는 `null` 하나만 나가고, 받은 쪽은
 * 들고 있던 사본(번들 또는 기기)을 그대로 쓴다. 아직 한 번도 안 넣은 서버(`updatedAt: null`)도 쓸
 * 것이 없어 `null` 이다.
 *
 * 계약은 서버 저장소와 나눠 갖는다. 필드를 더할 때 양쪽을 함께 본다.
 */
import { parseBossCatalog } from '../lib/boss/catalog'
import type { BossCatalog } from '../types/boss-catalog'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. 결산 조회와 같은 값이다.
 *
 * 이 값이 늦게 오면 화면에 늘어나는 것이 없다. 번들 사본으로 이미 서 있다.
 */
const TIMEOUT_MS = 4_000

/** 못 받았거나 계약을 어겼거나 서버가 아직 비었으면 `null`. */
export async function fetchBossCatalog(): Promise<BossCatalog | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/bosses`, { signal: controller.signal })
    if (response.status !== 200) return null

    const catalog = parseBossCatalog((await response.json()) as unknown)
    return catalog?.updatedAt == null ? null : catalog
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
