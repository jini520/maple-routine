/**
 * 강화 비용 다시 매기기 요청. 합계는 받을 때 비용을 매겨 저장하므로, 계산 코드나 비용 표를 고친 기간은 넥슨 API 에서 다시
 * 받아야 한다. 그 기간을 환경 변수로 건다. 기기 표도 이 목록을 읽어 새로 깐 기기가 건너뛸 요청을 적는다.
 *
 * @see docs/features/cashbook.md
 */

/** 다시 받을 강화 내역 종류. 넥슨 강화 내역 API 넷이다. */
export type RecomputeKind = 'cube' | 'starforce' | 'potential' | 'soul_potential'

const ALL_KINDS: readonly RecomputeKind[] = ['cube', 'starforce', 'potential', 'soul_potential']

/** 요청 하나. `id` 로 계정마다 진행과 완료를 기억한다. */
export interface RecomputeRequest {
  id: string
  /** KST `YYYY-MM-DD`. 두 끝을 포함한다 */
  from: string
  to: string
  kinds: readonly RecomputeKind[]
  /** 받은 날 가운데 슈페리얼 장비의 스타포스 줄이 있는 날만 갈아 끼운다. 빼면 거짓이다 */
  superiorOnly: boolean
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function requestOf(raw: unknown): RecomputeRequest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { id, from, to, kinds, superiorOnly = false } = raw as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || id.length > 100) return null
  if (typeof from !== 'string' || typeof to !== 'string' || !DATE.test(from) || !DATE.test(to) || from > to) return null
  if (typeof superiorOnly !== 'boolean') return null
  if (kinds === undefined) return { id, from, to, kinds: ALL_KINDS, superiorOnly }
  if (!Array.isArray(kinds) || kinds.length === 0) return null
  if (!kinds.every((kind) => (ALL_KINDS as readonly unknown[]).includes(kind))) return null
  return { id, from, to, kinds: kinds as RecomputeKind[], superiorOnly }
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
