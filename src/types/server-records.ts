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

/** 묶음의 한 건 결과. 실패한 건만 평소 대기 표에 넣는다. */
export type BatchItemResult = { recordId: string | null; ok: true } | { recordId: string | null; ok: false; reason: string }
