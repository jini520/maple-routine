/**
 * 로그인 실패 문구. 스토어(features)가 이 함수를 쓰므로 app/ 이 아니라 features/ 에 있다
 * (features → app 은 레이어가 거꾸로다). features/schedule-sync/format.ts 와 같은 자리.
 */
import { isInvalidApiKeyError, NexonMaintenanceError, NexonRateLimitError } from '../../nexon/errors'
import type { AuthError } from './state'

/** 키를 넣다 받은 실패의 종류. 로그인 화면 · 429 모달의 키 바꾸기 · 계정 관리가 같은 갈래로 가른다. */
export function toAuthError(error: unknown): AuthError {
  // 400 OPENAPI00005 도 무효 키다(판정은 nexon/errors 한 곳). 이 폼에서 키를 잘못 입력했을 때
  // 네트워크 오류라고 말하면 원인이 키인데 네트워크를 가리키게 된다.
  if (isInvalidApiKeyError(error)) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  if (error instanceof NexonMaintenanceError) {
    return { kind: error.scope === 'game' ? 'gameMaintenance' : 'apiMaintenance' }
  }
  return { kind: 'network' }
}

export function formatAuthError(error: AuthError): string {
  switch (error.kind) {
    case 'invalidApiKey':
      return 'API 키가 유효하지 않습니다'
    // 처방을 붙이지 않는다. 이 함수의 반환값은 전부 토스트 본문이고 Toast 본문이 truncate 라
    // 한 줄이 상한이다. 같은 429 가 `app/settings/error-message.ts` 에서 처방까지 담아 더 긴
    // 것은 그쪽이 인라인 자리라서다. 문구가 갈리는 것이 의도이니 통일하지 말 것.
    case 'rateLimited':
      return '호출 한도를 초과했습니다'
    case 'network':
      return '네트워크 오류가 발생했습니다'
    case 'storageWriteFailed':
      return '기기에 저장하지 못했습니다'
    // 키 입력 화면에는 점검 배너를 세울 자리가 없어 이 토스트가 알린다.
    case 'gameMaintenance':
      return '메이플스토리 API 점검 중입니다'
    case 'apiMaintenance':
      return '넥슨 Open API 점검 중입니다'
  }
}
