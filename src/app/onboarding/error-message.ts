import type { OnboardingError } from '../../features/onboarding/state'

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
