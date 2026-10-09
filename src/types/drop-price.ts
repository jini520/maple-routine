/**
 * 서버로 보내는 드롭 판매가 한 건. **서버의 `drop_prices` 와 칸이 맞는다.**
 *
 * 분배 인원 · 비율 · 수수료 넷은 안 싣는다. 그것들은 내 몫을 세는 재료이고 서버가 모으는 것은
 * 시세다. `quantity` 도 안 싣는다 - 항상 1 이다.
 */
export interface DropPricePayload {
  /** 기기가 만든 v4 uuid. 서버에서 같은 기록의 수정을 잇는 열쇠다. */
  dropRecordId: string
  itemKey: string
  /** **판매 총액**이다. 내 몫이 아니다. */
  priceMeso: number
  /** 주간은 리셋일 `YYYY-MM-DD`, 월간은 `YYYY-MM`. 불변이라 추이의 축이 된다. */
  periodKey: string
  /** 기록 시점의 월드. 기기 캐시에 월드가 없던 기록은 `null` 이고 그대로 보낸다. */
  worldKey: string | null
  /** 반지 레벨이 시세를 가른다. 반지가 아니면 `null`. */
  ringLevel: number | null
  /** 장비 부위. 해당 갈래가 아니면 `null`. */
  slot: string | null
}
