/** 등급을 물을지, 무엇을 물을지. 온보딩 · 기존 사용자 · 새 메이플 ID · 주간 확인을 한 규칙으로 가른다. */

export interface MvpAskInput {
  /** 추적 캐릭터가 속한 메이플 ID. 소속을 아직 모르는 캐릭터는 빠진다 */
  trackedAccountIds: readonly string[]
  /** 등급 이력이 있는 ID */
  historyAccountIds: ReadonlySet<string>
  weeklyOff: boolean
  lastCheckedWeek: string | null
  /** 이번 주의 목요일 */
  thisWeek: string
  bulkAsked: boolean
  /** 일괄 적용 대상이 하나라도 있나. 없으면 체크박스가 서도 할 일이 없다 */
  hasPastRecords: boolean
}

export type MvpAsk =
  /** 처음 고르기. 이력이 있는 ID 가 하나도 없다 */
  | { kind: 'select'; accountIds: string[]; bulk: boolean }
  /** 나중에 추적에 든 새 ID 만 */
  | { kind: 'newId'; accountIds: string[]; bulk: boolean }
  /** 주가 바뀐 뒤의 확인 */
  | { kind: 'weekly'; accountIds: string[] }

/** 추적 캐릭터가 속한 ID 가운데 이력이 없는 ID 가 있으면 그 ID 들로 묻고, 없으면 주가 바뀌었을 때 확인한다. */
export function decideMvpAsk(input: MvpAskInput): MvpAsk | null {
  const tracked = [...new Set(input.trackedAccountIds)]
  if (tracked.length === 0) return null
  const pending = tracked.filter((accountId) => !input.historyAccountIds.has(accountId))
  const bulk = !input.bulkAsked && input.hasPastRecords
  if (pending.length > 0) {
    const kind = pending.length === tracked.length ? 'select' : 'newId'
    return { kind, accountIds: pending, bulk }
  }
  if (input.weeklyOff || input.lastCheckedWeek === input.thisWeek) return null
  return { kind: 'weekly', accountIds: tracked }
}
