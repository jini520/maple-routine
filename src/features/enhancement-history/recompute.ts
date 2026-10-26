/**
 * 강화 비용 다시 매기기 요청. 합계는 받을 때 비용을 매겨 저장하므로, 계산 코드나 비용 표를 고친 기간은 넥슨 API 에서 다시
 * 받아야 한다. 그 기간을 환경 변수로 건다.
 *
 * @see docs/features/cashbook.md
 */
import { datesBetween } from '../../lib/calendar'
import type { EnhancementKind } from '../../nexon/history/client'

const ALL_KINDS: readonly EnhancementKind[] = ['cube', 'starforce', 'potential', 'soul_potential']

/** 요청 하나. `id` 로 계정마다 진행과 완료를 기억한다. */
export interface RecomputeRequest {
  id: string
  /** KST `YYYY-MM-DD`. 두 끝을 포함한다 */
  from: string
  to: string
  kinds: readonly EnhancementKind[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function requestOf(raw: unknown): RecomputeRequest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { id, from, to, kinds } = raw as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 100) return null
  if (typeof from !== 'string' || typeof to !== 'string' || !DATE.test(from) || !DATE.test(to) || from > to) return null
  if (kinds === undefined) return { id, from, to, kinds: ALL_KINDS }
  if (!Array.isArray(kinds) || kinds.length === 0) return null
  if (!kinds.every((kind) => (ALL_KINDS as readonly unknown[]).includes(kind))) return null
  return { id, from, to, kinds: kinds as EnhancementKind[] }
}

/**
 * 환경 변수 값을 요청 목록으로. 틀린 요청은 버린다. 고장 난 요청 하나가 회차를 막으면 안 되기 때문이다.
 *
 * @param raw JSON 배열 글자. 없으면 요청이 없다
 */
export function parseRecomputeRequests(raw: string | undefined): RecomputeRequest[] {
  if (raw === undefined || raw.trim() === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((one) => requestOf(one) ?? [])
}

/** 번들에 박힌 요청. `process.env.EXPO_PUBLIC_이름` 형태 그대로여야 babel-preset-expo 가 값을 넣는다. */
export const RECOMPUTE_REQUESTS: readonly RecomputeRequest[] = parseRecomputeRequests(
  process.env.EXPO_PUBLIC_ENHANCEMENT_RECOMPUTE,
)

/**
 * 이번 회차에 다시 받을 날. 기간을 조회 하한과 오늘 사이로 자르고, 진행 다음 날부터 앞에서 고른다.
 *
 * @param doneThroughDate 지난 회차까지 받은 마지막 날. 처음이면 `null`
 * @param perRound 한 회차에 받을 날 수의 한도. 넥슨 로그인 계정만 있고 API 키 계정은 `null`
 * @returns `last` 가 참이면 이 날들을 받고 나면 요청이 끝난다. 받을 날이 없어도 참이다
 */
export function recomputeDatesOf(
  request: RecomputeRequest,
  doneThroughDate: string | null,
  floorDateKey: string,
  todayDateKey: string,
  perRound: number | null,
): { dates: string[]; last: boolean } {
  const from = [request.from, floorDateKey].sort()[1]
  const to = [request.to, todayDateKey].sort()[0]
  const remaining = from > to ? [] : datesBetween(from, to).filter((date) => doneThroughDate === null || date > doneThroughDate)
  const dates = perRound === null ? remaining : remaining.slice(0, perRound)
  return { dates, last: dates.length === remaining.length }
}
