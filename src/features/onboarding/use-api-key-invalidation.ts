import { useEffect } from 'react'
import type { ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { useOnboardingStore } from './store'

/**
 * 스케줄 동기화·로스터 조회가 401/403 으로 실패하면 키 무효화 경로로 넘긴다([[ADR-115]] 결정 7).
 * 이동·토스트·저장소 삭제는 전부 invalidateApiKey() 안에 있고, 중복 호출은 그 안의 멱등 가드가 막는다.
 *
 * 왜 features/onboarding 에 사는가: 이 훅이 다루는 것은 동기화가 아니라 **온보딩 상태**다
 * (401 의 처방이 "상태를 awaitingApiKey 로 되돌리는 것"이라서 — 결정 2). `ScheduleSyncError` 는
 * 감지 쪽 어휘라 타입으로만 받는다.
 *
 * 여기에 자체 중복 가드(ref)를 두지 않는다 — 멱등은 invalidateApiKey() 안의 `status !== 'completed'`
 * 하나가 보장한다(결정 6). 두 겹으로 두면 어느 쪽이 진짜 계약인지 알 수 없어진다. dep 이 값 자체인
 * 것은 스토어가 실패마다 새 객체를 set 하기 때문이고(use-sync-error-toast 와 같은 근거), 그래서 같은
 * 값으로 재렌더되는 동안에는 effect 가 아예 다시 돌지 않는다.
 */
export function useApiKeyInvalidation(error: ScheduleSyncError | null): void {
  useEffect(() => {
    if (error?.kind !== 'invalidApiKey') {
      return
    }
    void useOnboardingStore.getState().invalidateApiKey()
  }, [error])
}
