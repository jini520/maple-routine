/**
 * 서버로 보내는 드롭 가격 기록 한 건. **서버의 `drop_prices` 와 칸이 맞는다.**
 *
 * 분배 인원 · 비율 · 수수료 넷은 안 싣는다. 그것들은 내 몫을 세는 재료이고 서버가 모으는 것은
 * 시세다. `quantity` 도 안 싣는다 - 항상 1 이다.
 */
export interface DropPricePayload {
  /** 기기가 만든 v4 uuid. 서버에서 같은 기록의 수정을 잇는 열쇠다. */
  dropRecordId: string
  itemKey: string
  /** 기기의 가격 상태를 서버 상태로 바꾼 것. 미입력은 `pending`, 기록 안함은 `skipped`. */
  status: DropRecordStatus
  /** **판매 총액**이다. 내 몫이 아니다. `completed` 만 값이 있고 나머지는 `null` 이다. */
  priceMeso: number | null
  /** 주간은 리셋일 `YYYY-MM-DD`, 월간은 `YYYY-MM`. 불변이라 추이의 축이 된다. */
  periodKey: string
  /** 기록 시점의 월드. 기기 캐시에 월드가 없던 기록은 `null` 이고 그대로 보낸다. */
  worldKey: string | null
  /** 반지 레벨이 시세를 가른다. 반지가 아니면 `null`. */
  ringLevel: number | null
  /** 어느 보스에서 얻었나. 보스 key. */
  boss: string
  /** 어느 난이도에서 얻었나. 난이도 key. 확정 전 난이도일 수 있고, 확정되면 다시 보낸다. */
  difficulty: string
}

/**
 * 본문으로 보내는 상태 셋. 서버의 넷째 `deleted` 는 기기에서 기록이 사라진 것이라 `DELETE` 가
 * 적는다.
 */
export type DropRecordStatus = 'pending' | 'completed' | 'skipped'
