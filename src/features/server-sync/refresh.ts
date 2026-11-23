/**
 * 동기화가 기기 줄을 고치거나 지운 표의 화면을 다시 읽게 하는 자리. 올리기가 서버 id 로 바꾸거나 거절로 지운 줄과, 받기가 넣은 줄이다.
 *
 * 기록 표는 판을 올려 그 표를 읽는 쿼리를 무효로 한다(`features/query/invalidation.ts`). Preferences 기록은 그 키를 읽는 스토어와 쿼리를
 * 다시 읽는다. 판은 동기화를 다시 깨우지 않게 올린다.
 *
 * @see docs/foundation/server-sync.md `넣은 뒤 화면`
 */
import { bumpBossDropRecordsRevision } from '../../storage/boss-drops'
import { bumpBossProfitRecordsRevision } from '../../storage/boss-profit'
import { bumpEnhancementTotalsRevision } from '../../storage/enhancement-totals'
import { bumpIncomeRecordsRevision } from '../../storage/income'
import { bumpInventoryItemsRevision } from '../../storage/inventory'
import type { ServerSyncTable } from '../../storage/server-sync-queue'
import { bumpSpendRecordsRevision } from '../../storage/spend'
import { useBarOrderStore } from '../bar-order/store'
import { useBossProfitCalculatorStore } from '../boss-profit-calculator/store'
import { useBossSchedulerStore } from '../boss-scheduler/store'
import { useCharacterSelectionStore } from '../character-selection/store'
import { useContentSchedulerStore } from '../content-scheduler/store'
import { useFigureMotionStore } from '../figure-motion/store'
import { requestNotificationReconcile } from '../local-notifications/run'
import { useMapleIdNamesStore } from '../maple-id/names'
import { useMvpGradeSettingsStore } from '../mvp-grade/settings-store'
import { useMvpGradeStore } from '../mvp-grade/store'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { useQuickLinksStore } from '../quick-links/store'
import { useTrackingModeStore } from '../tracking-mode/store'
import { withoutWakingServerSync } from './wake-guard'

const ignore = (): undefined => undefined

/** 기록 표의 판을 올린다. 판이 같은 작업 안에서 모여 쿼리마다 한 번 무효화된다. */
function bumpRecordTables(tables: ReadonlySet<ServerSyncTable>): void {
  if (tables.has('bossProfitEntries') || tables.has('bossSplitSettings')) bumpBossProfitRecordsRevision()
  if (tables.has('bossProfitEntries') || tables.has('bossDrops')) bumpBossDropRecordsRevision()
  if (tables.has('cashbookEntries') || tables.has('inventoryItems')) {
    bumpIncomeRecordsRevision()
    bumpSpendRecordsRevision()
  }
  if (tables.has('inventoryItems')) bumpInventoryItemsRevision()
  if (tables.has('enhancementTotals') || tables.has('enhancementSettledDays')) bumpEnhancementTotalsRevision()
}

/**
 * 표를 읽는 화면을 다시 읽게 한다. 기다리지 않는다. 스토어의 다시 읽기는 실패해도 그 화면이 다음에 열릴 때 다시 읽는다.
 *
 * @param tables 기기 줄을 고치거나 지운 서버 표 이름
 */
export function refreshAfterServerSync(tables: ReadonlySet<ServerSyncTable>): void {
  withoutWakingServerSync(() => bumpRecordTables(tables))
  const has = (...names: ServerSyncTable[]): boolean => names.some((name) => tables.has(name))
  // 설정 화면을 연 적이 없으면 읽지 않는다. 처음 열 때 읽는다.
  const reloadMvpSettings = (): void => {
    if (useMvpGradeSettingsStore.getState().status === 'ready') void useMvpGradeSettingsStore.getState().load().catch(ignore)
  }
  if (has('mvpGradeHistory', 'accountSettings')) reloadMvpSettings()
  // 화면에 보일 때 붙이는 MVP 할인이 이 등급 문맥을 읽는다. 자동 수수료는 등급을 바꾼 기기가 다시 세어 올린 값이 함께 온다.
  if (has('mvpGradeHistory')) void useMvpGradeStore.getState().reload().catch(ignore)
  if (has('manualTrackedItems', 'sharedContentProgress', 'accountSettings')) {
    void useContentSchedulerStore.getState().reloadLocal().catch(ignore)
    void useBossSchedulerStore.getState().reloadLocal().catch(ignore)
  }
  if (has('mapleIdNames')) void useMapleIdNamesStore.getState().restoreFromStorage().catch(ignore)
  if (has('representativeCharacterMotions')) void useFigureMotionStore.getState().restoreFromStorage().catch(ignore)
  if (has('trackedCharacters')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trackedOcids() })
    void useCharacterSelectionStore.getState().reloadRepresentative().catch(ignore)
  }
  if (has('accountSettings')) {
    void useTrackingModeStore.getState().restoreFromStorage().catch(ignore)
    void useQuickLinksStore.getState().restoreFromStorage().catch(ignore)
  }
  if (has('accountSettings', 'bottomBarSubPageOrders')) void useBarOrderStore.getState().restoreFromStorage().catch(ignore)
  if (has('partyAppointments')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.partyAppointments() })
    void requestNotificationReconcile().catch(ignore)
  }
  if (has('bossProfitCalculatorRecords')) void useBossProfitCalculatorStore.getState().reloadRecords().catch(ignore)
}
