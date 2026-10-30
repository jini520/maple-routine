/**
 * 서버로 보내는 보스 처치 기간 한 건. 서버의 `boss_clears` 와 칸이 맞는다. 기기의 `boss_party_periods` 중 처치한 행이다.
 *
 * 분배가 비율이면 내 몫 · 비율 합이 있고, 균등이면 둘 다 `null` 이다.
 */
export interface BossClearPayload {
  /** 기기의 기간 행 id. 서버에서 같은 기간의 수정을 잇는 열쇠다. */
  periodRecordId: string
  ocid: string
  boss: string
  difficulty: string
  cycle: 'weekly' | 'monthly'
  periodKey: string
  worldKey: string | null
  priceMeso: number
  /** 받은 몫. 분배와 수수료를 뗀 값이다. */
  payoutMeso: number
  splitMode: 'even' | 'ratio'
  partySize: number
  myShare: number | null
  sharesTotal: number | null
  splitFeePercent: number | null
  defeatedDate: string | null
  source: 'auto' | 'manual'
}

/** 가계부 품목 한 줄. 기기의 `cashbook_entry_items` 와 칸이 맞는다. 차례는 배열 순서다. */
export interface CashbookEntryItemPayload {
  itemKey: string | null
  itemName: string | null
  formKey: string | null
  itemKindKey: string | null
  quantity: number | null
  fromLevel: number | null
  toLevel: number | null
  amountMeso: number | null
  tariffMeso: number | null
  saleFeePercent: number | null
  saleFeeMeso: number | null
  amountPoint: number | null
  pointPer100mMeso: number | null
  amountCash: number | null
  fragmentCount: number | null
  untradableFragmentCount: number | null
  fragmentPriceMeso: number | null
  hexaActivation: boolean | null
}

/**
 * 서버로 보내는 가계부 기록 한 건. 서버의 `cashbook_entries` 와 칸이 맞는다. 사냥 계산기 입력은 안 싣는다.
 *
 * 캐릭터가 없는 기록만 `accountRecordId` 로 넥슨 계정을 알린다.
 */
export interface CashbookEntryPayload {
  entryRecordId: string
  ocid: string | null
  accountRecordId: string | null
  entryType: 'income' | 'spend'
  categoryKey: string
  entryDate: string
  items: CashbookEntryItemPayload[]
}

/**
 * 서버로 보내는 강화 합계 한 줄. 서버의 `enhancement_totals` 와 칸이 맞는다. 비용은 MVP 할인 전 두 몫이다.
 *
 * 강화 내역은 넥슨이 캐릭터 이름만 줘서 ocid 대신 이름을 싣는다.
 */
export interface EnhancementTotalPayload {
  totalRecordId: string
  /** 받은 자격의 넥슨 계정 id */
  accountRecordId: string | null
  characterName: string
  historyDate: string
  enhancementCategory: string
  itemKey: string | null
  itemName: string
  attempts: number
  attemptCostMeso: number
  destroyDefenceCostMeso: number
}

/** 묶음의 한 건 결과. 실패한 건만 평소 대기 표에 넣는다. */
export type BatchItemResult = { recordId: string | null; ok: true } | { recordId: string | null; ok: false; reason: string }

/** 강화 합계에서 빼거나 이벤트 월드를 판정하지 못한 줄을 날짜 · 종류 · 이유 · 장비마다 센 값. 캐릭터 이름은 싣지 않는다. */
export interface EnhancementAnomaly {
  historyDate: string
  enhancementType: 'cube' | 'starforce' | 'potential' | 'soul_potential'
  anomalyType: 'event_world_unknown' | 'no_level' | 'no_grade' | 'no_star' | 'no_type' | 'no_cost'
  itemKey: string | null
  /** 응답의 장비 이름. 판정하지 못한 줄은 장비와 무관해 빈 글자다 */
  itemName: string
  rowCount: number
  /** 캐릭터 목록 요청의 실패 이유. 판정하지 못한 줄만 있다 */
  detail: string | null
}
