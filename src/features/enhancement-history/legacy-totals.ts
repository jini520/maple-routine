/**
 * 옛 강화 원본 표(`enhancement_history`)를 합계로 한 번 옮기는 부팅 단계. 수집기와 가계부가 합계를 읽기 전에 기다린다.
 *
 * SQLite 버전 이관에서 못 하는 이유는 이벤트 월드를 가리는 캐릭터 이름 목록과 계정 id 가 Preferences 에 있어서다.
 * 옛 원본은 메인 계정의 자격으로 받은 것이라 메인 계정으로 옮긴다.
 */
import { mainNexonAccountIdOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import { listEnhancementHistoryDates, loadEnhancementHistory } from '../../storage/enhancement-history'
import { replaceEnhancementTotals } from '../../storage/enhancement-totals'
import { isEnhancementTotalsMoved, markEnhancementTotalsMoved } from '../../storage/enhancement-totals-moved'
import { getEventWorldNames } from '../../storage/event-world-names'
import type { EnhancementKind } from '../../nexon/history/client'
import { summarizeEnhancement } from './spending'
import { enhancementAnomaliesOf, reportEnhancementAnomalies } from './anomalies'
import type { EnhancementAnomaly } from '../../types/server-records'

let moving: Promise<void> | null = null

/**
 * 옮긴 적이 없으면 옮긴다. 계정이나 이벤트 월드 이름 목록이 아직 없으면 다음 호출이 다시 본다. 실패해도 던지지 않고 다음 호출이
 * 다시 돈다.
 *
 * 서버로는 따로 보내지 않는다. 과거 올리기가 지출로 세는 합계 줄을 모두 올린다.
 *
 * @example await ensureEnhancementTotals()
 */
export function ensureEnhancementTotals(): Promise<void> {
  moving ??= move().catch(() => {
    moving = null
  })
  return moving
}

async function move(): Promise<void> {
  if (await isEnhancementTotalsMoved()) return
  const accountId = mainNexonAccountIdOf(await getAuthConfig())
  // 이름 목록 없이 옮기면 이벤트 월드 판정이 빈 줄이 남는다. 옛 날짜는 다시 받지 않아 그 지출이 영영 안 보인다.
  const eventNames = await getEventWorldNames()
  if (accountId === null || eventNames === null) {
    moving = null
    return
  }
  const now = new Date()
  const anomalies: EnhancementAnomaly[] = []
  for (const dateKey of await listEnhancementHistoryDates()) {
    const entries = await loadEnhancementHistory([dateKey])
    for (const kind of ['cube', 'starforce', 'potential', 'soul_potential'] as const satisfies readonly EnhancementKind[]) {
      const ofKind = entries.filter((entry) => entry.kind === kind)
      if (ofKind.length === 0) continue
      await replaceEnhancementTotals(accountId, kind, dateKey, summarizeEnhancement(ofKind, eventNames), now)
      anomalies.push(...enhancementAnomaliesOf(ofKind, eventNames, null))
    }
  }
  await markEnhancementTotalsMoved()
  // 옮기며 빠진 줄도 원본을 버리기 전에 알린다. 표시를 먼저 적어, 보내기가 늦어도 옮기기를 다시 하지 않는다.
  void reportEnhancementAnomalies(anomalies)
}

/** 테스트가 한 번 돈 상태를 지운다. */
export function __resetEnhancementTotalsMoveForTest(): void {
  moving = null
}
