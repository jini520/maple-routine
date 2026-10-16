/**
 * 우리 서버의 게임 데이터 표 조회. `settlement.ts` 와 같은 자리, 같은 규칙이다.
 *
 * **못 받았으면 표를 바꾸지 않는다.** 응답 전체가 아니라 칸마다 본다. 칸 하나가 계약을 어기거나
 * 서버가 아직 안 넣은 표(`updatedAt: null`)면 그 칸만 `null` 이고 나머지 칸은 쓴다. 응답 자체를 못
 * 받았으면 `null` 하나만 나간다.
 *
 * 계약은 서버 저장소와 나눠 갖는다. 칸을 더할 때 양쪽을 함께 본다.
 */
import { parseBossCatalog } from '../lib/boss/catalog'
import type { GameData } from '../types/game-data'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. 결산 조회와 같은 값이다.
 *
 * 이 값이 늦게 오면 화면에 늘어나는 것이 없다. 번들 사본으로 이미 서 있다.
 */
const TIMEOUT_MS = 4_000

/** 칸 하나. 계약을 어겼거나 서버가 아직 비었으면 `null`. */
function section<T extends { updatedAt: string | null }>(
  value: unknown,
  parse: (value: unknown) => T | null,
): T | null {
  const parsed = parse(value)
  return parsed?.updatedAt == null ? null : parsed
}

/** 못 받았거나 응답이 객체가 아니면 `null`. 칸마다의 실패는 그 칸의 `null` 이다. */
export async function fetchGameData(): Promise<GameData | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/game-data`, { signal: controller.signal })
    if (response.status !== 200) return null

    const body = (await response.json()) as unknown
    if (typeof body !== 'object' || body === null) return null
    const sections = body as Record<string, unknown>

    return { bosses: section(sections.bosses, parseBossCatalog) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
