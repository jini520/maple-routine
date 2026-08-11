// 스케줄 동기화의 **에러 어휘** — 타입과 매핑 함수를 한곳에 둔다(ADR-094 결정 7).
//
// 별도 모듈인 이유는 순환 때문이다: 로스터 조회와 동기화 오케스트레이션이 둘 다 이 어휘를
// 쓰는데, 어느 한쪽에 두면 다른 쪽이 그쪽을 import 하면서 서로를 가리키게 된다.

import { isInvalidApiKeyError, NexonBadRequestError, NexonRateLimitError } from '@core/nexon/errors'
// ADR-067 결정 1: 400 하나에 처방이 전혀 다른 세 실패가 들어 있어(nexon-api.md "에러 코드")
// 종류를 갈라 담는다. 재시도 가능성이 셋 다 다르다 — characterUnavailable은 영구,
// notCollected는 나중에 자동으로 풀리고, periodOutOfRange는 그 날짜에 대해 영구다.
export type ScheduleSyncError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'characterUnavailable' } // 400 OPENAPI00003 — 이 ocid를 조회할 수 없다(영구)
  | { kind: 'periodOutOfRange' } // 400 OPENAPI00004 — 그 날짜를 조회할 수 없다(원인은 호출 측이 날짜로 판정)
  | { kind: 'notCollected' } // 400 OPENAPI00009 — 아직 집계 전(시간이 지나면 풀린다)
  | { kind: 'network' } // 그 외 네트워크/파싱 실패 + 코드를 모르는 400

// 호출부가 reject를 원인으로 변환할 수 있게 export한다([[ADR-062]] 결정 2) — 피커·온보딩 스텝이
// getCharacterPickerRoster의 catch에서 이걸 통과시켜 loadError로 내려준다.
export function toScheduleSyncError(error: unknown): ScheduleSyncError {
  // ADR-115 결정 9: 401/403 만이 아니라 400 OPENAPI00005 도 무효 키다. 판정은 nexon/errors 한 곳.
  // **이 분기가 400 분기보다 앞이어야 한다** — 아래 NexonBadRequestError 검사에 먼저 걸리면
  // 00005 가 "모르는 400" 으로 network 에 흡수돼 원래 결함으로 되돌아간다.
  if (isInvalidApiKeyError(error)) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  // 코드를 아는 400만 갈라내고, 모르는 코드·본문 없는 400은 network로 degrade한다 —
  // 넥슨이 코드 체계를 바꿔도 최악의 경우 지금 동작(재시도 유도)으로 떨어지게 하는 안전판이다
  // ([[ADR-067]] 트레이드오프).
  if (error instanceof NexonBadRequestError) {
    if (error.code === 'OPENAPI00003') {
      return { kind: 'characterUnavailable' }
    }
    if (error.code === 'OPENAPI00004') {
      return { kind: 'periodOutOfRange' }
    }
    if (error.code === 'OPENAPI00009') {
      return { kind: 'notCollected' }
    }
  }
  return { kind: 'network' }
}
