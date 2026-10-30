/**
 * 쿼리에 붙는 표식. 저장(`persist`) · 자정 무효화(`source`) · 표의 판 무효화(`tables`) · 다른 쿼리에 기대는 무효화
 * (`dependsOn`)가 열쇠가 아니라 이것을 본다.
 */

/** 판을 올리고 구독 함수를 내는 저장소 표. 이름은 SQLite 표 이름이고 조회 원장만 Preferences 다. */
export type RecordTable =
  | 'boss_profit_records'
  | 'boss_drop_records'
  | 'income_records'
  | 'spend_records'
  | 'enhancement_totals'
  | 'schedule_probe_ledger'

/** 다른 쿼리가 새 데이터를 들면 무효화되는 관계. 이름은 `queryKeys` 의 첫 칸과 같다. */
export type QueryDependency = 'schedule-round'

export interface QueryMeta extends Record<string, unknown> {
  /** 참이면 성공한 데이터를 기기에 저장한다. */
  persist?: boolean
  /** `nexon` 이면 KST 자정에 무효화된다. */
  source?: 'nexon'
  /** 이 쿼리가 읽는 표. 그 표의 판이 오르면 무효화된다. */
  tables?: readonly RecordTable[]
  /** 이 쿼리가 기대는 쿼리. 그 쿼리가 새 데이터를 들면 무효화된다. */
  dependsOn?: readonly QueryDependency[]
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: QueryMeta
  }
}
