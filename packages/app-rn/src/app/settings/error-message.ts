// 계정 변경 흐름의 실패 문구. **순수 함수라 RN 으로 오며 한 글자도 안 바뀐다** — 화면이 아니라
// 문자열이고, 그 문자열이 어디에 놓이는지가 문구를 정한다([[ADR-114]] 결정 4).
import type { SettingsError } from '@core/features/settings/state'

export function formatSettingsError(error: SettingsError): string {
  switch (error.kind) {
    case 'invalidApiKey':
      return 'API 키가 유효하지 않습니다'
    // 여기는 계정 카드 안 인라인(AccountFlowStatus 의 <Text>)이라 줄바꿈이 되므로 처방까지 담는다
    // ([[ADR-114]] 결정 4). 같은 429가 features/onboarding/format.ts 에서 원인 한 줄로 짧은 것은
    // 그쪽이 토스트(truncate)라서다 — 문구가 갈리는 것이 의도이니 통일하지 말 것.
    case 'rateLimited':
      return '호출 한도를 초과했습니다. 입력하신 API 키가 서비스 단계 키인지 확인해주세요'
    case 'network':
      return '네트워크 오류가 발생했습니다'
    case 'storageWriteFailed':
      return '기기에 저장하지 못했습니다. 다시 시도해주세요'
  }
}
