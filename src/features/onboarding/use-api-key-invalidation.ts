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
 * 여기에 자체 **멱등** 가드(ref)를 두지 않는다 — 동시 401 이 토스트·이동을 한 번으로 접는 것은
 * invalidateApiKey() 안의 `status !== 'completed'` 하나가 보장한다(결정 6). dep 이 값 자체인
 * 것은 스토어가 실패마다 새 객체를 set 하기 때문이고(use-sync-error-toast 와 같은 근거), 그래서 같은
 * 값으로 재렌더되는 동안에는 effect 가 아예 다시 돌지 않는다.
 *
 * 아래 `routedErrors` 는 그 멱등 가드와 **다른 것을 막는다** — 두 겹이 아니다.
 * 동기화 스토어의 `error` 는 화면이 언마운트돼도 살아남는다(모듈 스코프 zustand). 그래서 키를 다시
 * 넣어 completed 로 돌아오면 화면이 다시 마운트되면서 **이미 처리한 그 객체**가 새 effect 로 들어오고,
 * 그때는 status 가 completed 라 멱등 가드를 통과해 **방금 저장한 유효한 키가 지워진다**(재입력할 때마다
 * 반복돼 앱 재시작 전까지 못 들어간다 — 실제로 재현됐다). 끊어야 할 고리는 "지속된 값"과 "새 실패"를
 * 훅이 구분하지 못하는 것이므로, 스토어가 실패마다 새 객체를 만든다는 이 파일의 전제를 그대로 써서
 * **이미 넘긴 객체를 기억**한다. 훅 인스턴스의 ref 로는 안 된다 — 그 수명이 화면과 같아서 재마운트를
 * 넘지 못한다. 스토어의 error 를 무효화 시점에 지우는 대안은 온보딩 스토어가 동기화 스토어 셋을
 * 거꾸로 알아야 해서 택하지 않았다.
 */
const routedErrors = new WeakSet<ScheduleSyncError>()

export function useApiKeyInvalidation(error: ScheduleSyncError | null): void {
  useEffect(() => {
    if (error?.kind !== 'invalidApiKey' || routedErrors.has(error)) {
      return
    }
    routedErrors.add(error)
    void useOnboardingStore.getState().invalidateApiKey()
  }, [error])
}
