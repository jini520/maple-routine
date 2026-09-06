/**
 * 계정 단위 강화 사용 내역. 큐브·스타포스·잠재 재설정 셋이 **같은 껍데기**를 쓴다.
 *
 * 지금까지 앱이 쓰던 API 와 갈리는 성질이 셋이다. **계정 단위**라 ocid 축이 없고(하루가 3콜이지
 * 캐릭터 수를 안 곱한다), 한 번에 오는 양에 상한이 있어 **커서로 이어받고**, 과거 날짜의 데이터는
 * **변하지 않는다**.
 *
 * 실측(2026-09-06): 정렬은 최신에서 과거로, `count` 는 상한이며(10 을 달라고 해도 8 이 온다),
 * 커서는 `date` 없이 이어받고, 같은 요청 두 번에 커서와 id 목록이 같다.
 *
 * @see docs/persistence/sqlite.md `enhancement_history`
 */
import { requestJson } from '../http'

/** 한 번에 달라고 하는 최대 건수. 상한이라 이보다 적게 올 수 있다. */
const PAGE_SIZE = 1000

export type EnhancementKind = 'cube' | 'starforce' | 'potential'

export interface EnhancementHistoryRow {
  /** 계정 전체에서 유일하다. 그대로 PK 로 쓴다 */
  id: string
  characterName: string
  /** `date_create` 원본(타임존 포함) */
  createdAt: string
  /** KST `YYYY-MM-DD`. 가계부 칸이 이 값으로 선다 */
  dateKey: string
  /** 줄 원본. **버리지 않는다.** 비용 표가 오면 여기서 계산한다 */
  payload: unknown
}

export interface EnhancementHistoryPage {
  rows: EnhancementHistoryRow[]
  /** 더 있으면 이어받을 커서. 없으면 그 날짜의 끝 */
  nextCursor: string | null
}

/** 종류마다 배열 이름이 다르다. `cube_history` · `starforce_history` · `potential_history`. */
function historyKeyOf(kind: EnhancementKind): string {
  return `${kind}_history`
}

/**
 * `2026-09-04T07:02:32.597+09:00` → `2026-09-04`.
 *
 * 응답이 이미 KST 오프셋을 달고 오므로 **앞 10자를 그대로 쓴다**. `new Date` 로 돌리면 기기
 * 시간대를 타서 같은 줄이 기기마다 다른 칸에 선다.
 */
function dateKeyOf(createdAt: string): string {
  return createdAt.slice(0, 10)
}

export interface EnhancementHistoryQuery {
  /** 그 날짜부터 최신 순으로 받는다 */
  dateKey?: string
  /** 이어받기. **커서가 날짜 맥락을 들고 있어** 날짜와 함께 보내지 않는다 */
  cursor?: string
}

/**
 * 한 쪽을 받는다. **던진다.** 호출부가 실패를 원장에 안 적고 다음 회차에 다시 온다.
 *
 * @example const page = await fetchEnhancementHistory(key, 'cube', { dateKey: '2026-09-04' })
 */
export async function fetchEnhancementHistory(
  apiKey: string,
  kind: EnhancementKind,
  query: EnhancementHistoryQuery,
): Promise<EnhancementHistoryPage> {
  const tail = query.cursor === undefined ? `date=${query.dateKey}` : `cursor=${query.cursor}`
  const body = await requestJson<Record<string, unknown>>(
    `/maplestory/v1/history/${kind}?count=${PAGE_SIZE}&${tail}`,
    apiKey,
  )

  const raw = body[historyKeyOf(kind)]
  // 배열이 아니면 빈 쪽이다. 던지면 그 날짜가 영영 안 채워진다.
  const rows = Array.isArray(raw) ? raw : []

  return {
    rows: rows.map((entry) => {
      const record = entry as Record<string, unknown>
      const createdAt = String(record.date_create ?? '')
      return {
        id: String(record.id ?? ''),
        characterName: String(record.character_name ?? ''),
        createdAt,
        dateKey: dateKeyOf(createdAt),
        payload: entry,
      }
    }),
    nextCursor: typeof body.next_cursor === 'string' ? body.next_cursor : null,
  }
}
