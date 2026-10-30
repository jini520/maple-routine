/**
 * 컨텐츠 스케줄러 화면이 데이터를 받는 훅. 캐시에서 캐릭터 뷰를 만들고, 스토어의 기기 값(수동 추적)을 추적 목록 · 모드가
 * 바뀔 때 다시 읽힌다.
 *
 * 자동 진입은 안의 `useScheduleQueries` 가 한다. 당김 · 다시 시도는 `refresh` 로 신선해도 받는다.
 */
import { useEffect, useMemo } from 'react'

import { useCharacterSelectionStore } from '../character-selection/store'
import type { ScheduleSyncError } from '../schedule-sync/errors'
import { refreshSchedules } from '../schedule-sync/schedule-query'
import { useScheduleQueries, type ScheduleStatus } from '../schedule-sync/use-schedule-queries'
import { useTrackingModeStore } from '../tracking-mode/store'
import { useContentSchedulerStore } from './store'
import { buildContentViews, type ContentCharacterView } from './views'

export interface ContentSchedule {
  status: ScheduleStatus
  /** 레벨 내림차순. 화면은 `orderByTracked` 로 추적 목록 순서를 얹는다. */
  characters: ContentCharacterView[]
  error: ScheduleSyncError | null
  trackedOcids: string[] | null
  /** 신선해도 받는다. 당김 · 다시 시도가 부른다. */
  refresh: () => Promise<void>
}

export function useContentSchedule(): ContentSchedule {
  const { snapshot, status, error, trackedOcids } = useScheduleQueries()
  const characters = useMemo(() => buildContentViews(snapshot), [snapshot])
  const mode = useTrackingModeStore((state) => state.mode)
  const loadLocal = useContentSchedulerStore((state) => state.loadLocal)
  // 배열 자체는 매 렌더 새 참조일 수 있어 deps 로 쓸 수 없다. 목록이 실제로 바뀌었을 때만 다시 읽는다.
  const ocidsKey = snapshot.ocids.join(',')

  // 고른 캐릭터와 대표 표식은 선택 스토어가 읽는다. 이 훅이 읽어 자기 상태에 넣으면 출처가 두 벌이 된다.
  useEffect(() => {
    void useCharacterSelectionStore.getState().hydrate()
  }, [])

  useEffect(() => {
    void loadLocal(ocidsKey === '' ? [] : ocidsKey.split(','))
  }, [ocidsKey, mode, loadLocal])

  return { status, characters, error, trackedOcids, refresh: refreshSchedules }
}
