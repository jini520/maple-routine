/**
 * 로그인 실패 문구. 스토어(features)가 이 함수를 쓰므로 app/ 이 아니라 features/ 에 있다
 * (features → app 은 레이어가 거꾸로다). features/schedule-sync/format.ts 와 같은 자리.
 */
import type { AuthError } from './state'

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
      return '기기에 저장하지 못했습니다. 다시 시도해주세요'
  }
}
