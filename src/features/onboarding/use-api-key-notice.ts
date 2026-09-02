import { useEffect } from 'react'
import type { ApiKeyNoticeKind } from './state'
import type { ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { useOnboardingStore } from './store'

/**
 * 스케줄 동기화·로스터 조회가 **저장된 키로는 앞으로 갈 수 없는** 실패로 끝나면 키 재입력 경로로
 * 넘긴다. 원인은 둘이다:
 *
 * - `invalidApiKey`(401/403 · 400 `OPENAPI00005`). 키가 폐기됐다
 * - `rateLimited`(429). 개발 단계 키의 호출 한도를 넘었다(이슈 #176·#177·#178)
 *
 * 원인이 다른데 한 경로를 타는 이유는 **처방이 같기 때문**이다. 둘 다 지금 저장된 키로는 앞으로
 * 갈 수 없고 사용자가 새 키를 넣어야 한다. 처방이 같으면 화면도 같아야 한다.
 * 갈리는 것은 모달 문구뿐이라 그 구분만 `kind` 로 실어 보낸다.
 *
 * 여기서 하는 일은 **알리는 것뿐**이다. 모달을 띄우고, 이동·삭제는 사용자가 "확인"을 누를 때
 * 일어난다(결정 10). 중복 호출은 noticeApiKeyIssue() 안의 멱등 가드가 막는다.
 *
 * 왜 features/onboarding 에 사는가: 이 훅이 다루는 것은 동기화가 아니라 **온보딩 상태**다
 * (처방이 "상태를 awaitingApiKey 로 되돌리는 것"이라서 —). `ScheduleSyncError` 는
 * 감지 쪽 어휘라 타입으로만 받는다.
 *
 * 여기에 자체 **멱등** 가드(ref)를 두지 않는다. 동시 실패가 모달을 하나로 접는 것은
 * noticeApiKeyIssue() 안의 `apiKeyNotice !== null` 하나가 보장한다(
 * 결정 2 로 가드 조건이 "키 입력 화면에서는 알리지 않는다"로 바뀌었지만 멱등은 그대로다). dep 이 값
 * 자체인 것은 스토어가 실패마다 새 객체를 set 하기 때문이고(use-sync-error-toast 와 같은 근거),
 * 그래서 같은 값으로 재렌더되는 동안에는 effect 가 아예 다시 돌지 않는다.
 *
 * 아래 `routedErrors` 는 그 멱등 가드와 **다른 것을 막는다**. 두 겹이 아니다.
 * 동기화 스토어의 `error` 는 화면이 언마운트돼도 살아남는다(모듈 스코프 zustand). 그래서 키를 다시
 * 넣어 completed 로 돌아오면 화면이 다시 마운트되면서 **이미 처리한 그 객체**가 새 effect 로 들어오고,
 * 그때는 알림이 이미 꺼져 있어 멱등 가드를 통과해 **방금 저장한 유효한 키가 지워진다**(재입력할 때마다
 * 반복돼 앱 재시작 전까지 못 들어간다. 실제로 재현됐다). 429 도 확인하면 키를 지우므로 같은 함정을
 * 그대로 안는다. 끊어야 할 고리는 "지속된 값"과 "새 실패"를 훅이 구분하지 못하는 것이므로, 스토어가
 * 실패마다 새 객체를 만든다는 이 파일의 전제를 그대로 써서 **이미 넘긴 객체를 기억**한다. 훅 인스턴스의
 * ref 로는 안 된다. 그 수명이 화면과 같아서 재마운트를 넘지 못한다. 스토어의 error 를 무효화 시점에
 * 지우는 대안은 온보딩 스토어가 동기화 스토어 셋을 거꾸로 알아야 해서 택하지 않았다.
 */
const routedErrors = new WeakSet<ScheduleSyncError>()

const NOTICE_KIND: Partial<Record<ScheduleSyncError['kind'], ApiKeyNoticeKind>> = {
  invalidApiKey: 'invalid',
  rateLimited: 'rateLimited',
}

export function useApiKeyNotice(error: ScheduleSyncError | null): void {
  useEffect(() => {
    if (error === null || routedErrors.has(error)) {
      return
    }
    const kind = NOTICE_KIND[error.kind]
    if (kind === undefined) {
      return
    }
    routedErrors.add(error)
    useOnboardingStore.getState().noticeApiKeyIssue(kind)
  }, [error])
}
