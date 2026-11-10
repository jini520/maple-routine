/**
 * 옛 강화 원본 표(`enhancement_history`)를 합계로 한 번 옮기는 부팅 단계. 수집기와 가계부가 합계를 읽기 전에 기다린다.
 *
 * SQLite 버전 이관에서 못 하는 이유는 이벤트 월드를 가리는 캐릭터 이름 목록과 계정 id 가 Preferences 에 있어서다.
 * 옛 원본은 메인 계정의 자격으로 받은 것이라 메인 계정으로 옮긴다. 넥슨을 부르지 않으므로 줄은 앱이 그 이름으로 본 기간으로만
 * 캐릭터에 붙인다. 붙이지 못한 줄의 날은 다시 받을 날로 적어 수집기가 넥슨에서 그날 이름을 찾게 한다.
 */
import type { EventWorldJudgment } from '../../lib/enhancement/world'
import { sightedOwnerOf } from '../../lib/enhancement/sighted-owner'
import { mainNexonAccountIdOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import { getOwnerSightings, type EnhancementOwnerSighting } from '../../storage/character-accounts'
import { dropEnhancementHistory, listEnhancementHistoryDates, loadEnhancementHistory } from '../../storage/enhancement-history'
import { addEnhancementRefetch } from '../../storage/enhancement-refetches'
import { replaceEnhancementTotals } from '../../storage/enhancement-totals'
import { isEnhancementTotalsMoved, markEnhancementTotalsMoved } from '../../storage/enhancement-totals-moved'
import type { EnhancementKind } from '../../nexon/history/client'
import { eventWorldOf, summarizeEnhancement, type EnhancementSource, type EntryOwner } from './spending'
import { enhancementAnomaliesOf, reportEnhancementAnomalies } from './anomalies'
import { readEventWorldNames } from './event-world-names'
import type { EnhancementAnomaly } from '../../types/server-records'

/** 앱이 그 이름으로 본 기간의 캐릭터. 월드는 소속 기록에 적힌 월드다. */
function legacyOwnerOf(
  sightings: readonly EnhancementOwnerSighting[],
  entry: EnhancementSource,
  nexonAccountId: string,
): EntryOwner | null {
  const sighted = sightedOwnerOf(sightings, entry.characterName, entry.dateKey, nexonAccountId)
  if (sighted === null) return null
  const worldKey = sightings.find((sighting) => sighting.ocid === sighted.ocid && sighting.worldKey !== null)?.worldKey ?? null
  return { ocid: sighted.ocid, accountId: sighted.accountId, worldName: null, worldKey, preLeap: false }
}

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
  // 옮긴 기기는 원본을 지운다. 여러 버전을 건너뛰어 올라온 기기는 옮긴 뒤에 지운다.
  if (await isEnhancementTotalsMoved()) {
    await dropEnhancementHistory()
    return
  }
  const accountId = mainNexonAccountIdOf(await getAuthConfig())
  // 이름 목록은 수집기가 메인 계정의 목록을 받은 뒤에 선다. 그 전에 옮기면 이벤트 월드 판정이 빈 줄이 남는다. 옛 날짜는 다시
  // 받지 않아 그 지출이 영영 안 보인다.
  const eventNames = readEventWorldNames()
  if (accountId === null || eventNames === null) {
    moving = null
    return
  }
  const sightings = await getOwnerSightings()
  // 옛 이름 목록은 이벤트 월드 캐릭터만 든다. 소속 기록에 월드가 없는 캐릭터도 이 이름이면 이벤트 월드다. 스타포스는 줄의 월드가
  // 이긴다.
  const judge = (entry: EnhancementSource, owner: EntryOwner): EventWorldJudgment => {
    const judgment = eventWorldOf(entry, owner)
    return entry.kind !== 'starforce' && judgment.eventWorld === false && eventNames.has(entry.characterName)
      ? { eventWorld: true, unknownWorld: null }
      : judgment
  }
  const now = new Date()
  const anomalies: EnhancementAnomaly[] = []
  for (const dateKey of await listEnhancementHistoryDates()) {
    const entries = await loadEnhancementHistory([dateKey])
    for (const kind of ['cube', 'starforce', 'potential', 'soul_potential'] as const satisfies readonly EnhancementKind[]) {
      const ofKind = entries.filter((entry) => entry.kind === kind)
      if (ofKind.length === 0) continue
      const ownerOf = (entry: EnhancementSource) => legacyOwnerOf(sightings, entry, accountId)
      if (ofKind.some((entry) => ownerOf(entry) === null)) await addEnhancementRefetch(accountId, kind, dateKey, now)
      await replaceEnhancementTotals(accountId, kind, dateKey, summarizeEnhancement(ofKind, ownerOf, judge), now)
      anomalies.push(
        ...enhancementAnomaliesOf(ofKind, (entry) => {
          const owner = ownerOf(entry)
          return owner === null ? null : judge(entry, owner)
        }),
      )
    }
  }
  await markEnhancementTotalsMoved()
  await dropEnhancementHistory()
  // 옮기며 빠진 줄도 알린다. 표시를 먼저 적어, 보내기가 늦어도 옮기기를 다시 하지 않는다.
  void reportEnhancementAnomalies(anomalies)
}

/** 테스트가 한 번 돈 상태를 지운다. */
export function __resetEnhancementTotalsMoveForTest(): void {
  moving = null
}
