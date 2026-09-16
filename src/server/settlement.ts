/**
 * 우리 서버의 결산 판정 조회. `notices.ts` 와 같은 자리, 같은 규칙이다.
 *
 * **못 받았으면 결산 중이라고 말하지 않는다.** 실패를 결산 중으로 읽으면 넥슨이 멀쩡한 낮에도
 * 안내 줄이 선다. 실패가 어떤 모양이든 밖으로는 `null` 하나만 나간다.
 *
 * 앱이 시각으로 가르지 않는 이유는 결산의 시작과 끝이 날마다 달라서다. 그 판정은 서버가 밤마다
 * `낟낟` 캐릭터를 조회해 들고 있다.
 */
import type { Settlement } from '../types/settlement'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. 공지 조회(8초)보다 짧다.
 *
 * 이 값이 늦게 오면 화면에 늘어나는 것이 없다. 안내 줄은 안 서 있으면 그만이고, 스케줄러 조회가
 * 이 기다림 때문에 늦어지는 편이 나쁘다.
 */
const TIMEOUT_MS = 4_000

/** 계약을 지킨 것만 통과시킨다. 어긴 응답은 모름이다. */
function toSettlement(value: unknown): Settlement | null {
  if (typeof value !== 'object' || value === null) return null
  const one = value as Record<string, unknown>

  if (typeof one.settling !== 'boolean') return null
  if (!one.settling) return { settling: false, startedAt: null }

  // 결산 중이라면서 시작 시각을 안 주면 닫은 구간을 알아볼 열쇠가 없다. 그 응답은 못 쓴다.
  if (typeof one.startedAt !== 'string' || one.startedAt === '') return null
  return { settling: true, startedAt: one.startedAt }
}

/** 못 받았거나 계약을 어겼으면 `null`. */
export async function fetchSettlement(): Promise<Settlement | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/settlement`, { signal: controller.signal })
    if (response.status !== 200) return null
    return toSettlement((await response.json()) as unknown)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
