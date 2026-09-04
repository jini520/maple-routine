import { useEffect } from 'react'
import type { ApiKeyNoticeKind } from './state'
import type { ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { useAuthStore } from './store'

/**
 * 스케줄 동기화·로스터 조회가 저장된 키로는 앞으로 갈 수 없는 실패로 끝나면 키 재입력 경로로
 * 넘긴다. 원인은 둘이다.
 *
 * - `invalidApiKey`(401/403 · 400 `OPENAPI00005`). 키가 폐기됐다
 * - `rateLimited`(429). 개발 단계 키의 호출 한도를 넘었다
 *
 * 원인이 다른데 한 경로를 타는 것은 처방이 같기 때문이다. 둘 다 사용자가 새 키를 넣어야 한다.
 * 갈리는 것은 모달 문구뿐이라 그 구분만 `kind` 로 실어 보낸다.
 *
 * 여기서 하는 일은 알리는 것뿐이다. 모달을 띄우고, 이동·삭제는 확인을 누를 때 일어난다.
 * 중복 호출은 `noticeApiKeyIssue()` 안의 멱등 가드가 막는다.
 *
 * `features/auth` 에 사는 것은 이 훅이 다루는 것이 동기화가 아니라 인증 상태이기
 * 때문이다. `ScheduleSyncError` 는 감지 쪽 어휘라 타입으로만 받는다.
 *
 * 아래 `routedErrors` 는 그 멱등 가드와 다른 것을 막는다. 동기화 스토어의 `error` 는 화면이
 * 언마운트돼도 살아남으므로(모듈 스코프 zustand), 키를 다시 넣어 앱이 다시 열리면 화면이
 * 다시 마운트되면서 이미 처리한 그 객체가 새 effect 로 들어온다. 그때는 알림이 이미 꺼져 있어
 * 멱등 가드를 통과해 방금 저장한 유효한 키가 지워진다. 그래서 이미 넘긴 객체를 기억한다. 훅
 * 인스턴스의 ref 로는 안 된다. 그 수명이 화면과 같아 재마운트를 넘지 못한다.
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
    useAuthStore.getState().noticeApiKeyIssue(kind)
  }, [error])
}
