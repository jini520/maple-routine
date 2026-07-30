// ADR-065 결정 1: 스토어(features)가 이 함수를 쓰므로 app/ 이 아니라 features/ 에 둔다
// (features → app 은 레이어가 거꾸로다). features/schedule-sync/format.ts 와 같은 자리.
import type { OnboardingError } from './state'

export function formatOnboardingError(error: OnboardingError): string {
  switch (error.kind) {
    case 'invalidApiKey':
      return 'API 키가 유효하지 않습니다'
    case 'rateLimited':
      return '잠시 후 다시 시도해주세요'
    case 'network':
      return '네트워크 오류가 발생했습니다'
    case 'storageWriteFailed':
      return '기기에 저장하지 못했습니다. 다시 시도해주세요'
  }
}
