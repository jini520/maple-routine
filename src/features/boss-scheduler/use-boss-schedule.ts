/**
 * 보스 스케줄러 화면이 데이터를 받는 훅. 캐시에서 캐릭터 뷰를 만들고, 스토어의 기기 값(파티 인원 · 수동 추적 · 직접
 * 완료)을 추적 목록 · 모드가 바뀔 때 다시 읽힌다. 컨텐츠 쪽 `useContentSchedule` 과 같은 모양이다. 직접 적은 완료는 기간
 * 키가 열쇠인 쿼리라 자정을 넘긴 렌더가 새 열쇠를 읽는다.
 */
import { useEffect, useMemo } from 'react'

import { useCharacterSelectionStore } from '../character-selection/store'
import type { ScheduleSyncError } from '../schedule-sync/errors'
import { refreshSchedules } from '../schedule-sync/schedule-query'
import { useScheduleQueries, type ScheduleStatus } from '../schedule-sync/use-schedule-queries'
import { useTrackingModeStore } from '../tracking-mode/store'
import { useManualCompleted, type ManualCompletedByOcid } from './manual-completed-query'
import { useBossSchedulerStore } from './store'
import { buildBossViews, type BossCharacterView } from './views'

export interface BossSchedule {
  status: ScheduleStatus
  /** 레벨 내림차순. 화면은 `orderByTracked` 로 추적 목록 순서를 얹는다. */
  characters: BossCharacterView[]
  error: ScheduleSyncError | null
  trackedOcids: string[] | null
  /**
   * 사용자가 직접 적은 완료(`bossKey|difficulty`)를 캐릭터별로. 이번 주 · 이번 달 것만이다. 표시 판정이 카드 · 주간 한도 ·
   * today 남은 스케줄에 함께 얹는다. 보스 수익에서 적으면 기록 판이 올라 그 자리에서 바뀐다.
   */
  manualCompletedByOcid: ManualCompletedByOcid
  /** 신선해도 받는다. 당김 · 다시 시도가 부른다. */
  refresh: () => Promise<void>
}

export function useBossSchedule(): BossSchedule {
  const { snapshot, status, error, trackedOcids } = useScheduleQueries()
  const characters = useMemo(() => buildBossViews(snapshot), [snapshot])
  const mode = useTrackingModeStore((state) => state.mode)
  const loadLocal = useBossSchedulerStore((state) => state.loadLocal)
  const ocidsKey = snapshot.ocids.join(',')
  const manualCompletedByOcid = useManualCompleted(new Date())

  useEffect(() => {
    void useCharacterSelectionStore.getState().hydrate()
  }, [])

  useEffect(() => {
    void loadLocal(ocidsKey === '' ? [] : ocidsKey.split(','))
  }, [ocidsKey, mode, loadLocal])

  return { status, characters, error, trackedOcids, manualCompletedByOcid, refresh: refreshSchedules }
}
