/**
 * 스케줄 동기화의 **에러 어휘**. 타입과 매핑 함수를 한곳에 둔다.
 *
 * 별도 모듈인 이유는 순환 때문이다: 로스터 조회와 동기화 오케스트레이션이 둘 다 이 어휘를
 * 쓰는데, 어느 한쪽에 두면 다른 쪽이 그쪽을 import 하면서 서로를 가리키게 된다.
 */

import {
  isInvalidApiKeyError,
  NexonBadRequestError,
  NexonNoCharacterError,
  NexonRateLimitError,
} from '../../nexon/errors'
// 400 하나에 처방이 전혀 다른 세 실패가 들어 있어 종류를 갈라 담는다. 재시도 가능성이 셋 다
// 다르다. characterUnavailable 은 영구, notCollected 는 나중에 자동으로 풀리고,
// periodOutOfRange 는 그 날짜에 대해 영구다.
/**
 * 모든 실패가 함께 드는 것. **그때 쓴 API 키다.**
 *
 * 무효화·한도 초과로 키를 지울 때 어느 것인지 가린다. 없으면 부른 쪽이 안 실어 보낸 것이고,
 * 그때는 지울 키를 못 가려 전부 지운다. 키가 여럿인 사용자에게 그것은 **다른 넥슨 계정의 키까지
 * 잃는 일**이라, 알림으로 이어지는 경로는 싣는다.
 */
interface WithApiKey {
  readonly apiKey?: string
}

// 유니온을 유지하는 것이 요점이다. `format.ts` 가 kind 를 전수 검사해서, 새 종류를 더하면
// 그 자리가 컴파일에서 걸린다. 평평한 인터페이스로 바꾸면 그 그물이 사라진다.
export type ScheduleSyncError =
  | ({ kind: 'invalidApiKey' } & WithApiKey) // 401/403 · 400 OPENAPI00005
  | ({ kind: 'rateLimited' } & WithApiKey) // 429
  | ({ kind: 'characterUnavailable' } & WithApiKey) // 400 OPENAPI00003. 이 ocid를 조회할 수 없다(영구)
  | ({ kind: 'periodOutOfRange' } & WithApiKey) // 400 OPENAPI00004. 그 날짜를 조회할 수 없다
  | ({ kind: 'notCollected' } & WithApiKey) // 400 OPENAPI00009. 아직 집계 전(시간이 지나면 풀린다)
  | ({ kind: 'network' } & WithApiKey) // 그 외 네트워크/파싱 실패 + 코드를 모르는 400

// 호출부가 reject 를 원인으로 변환할 수 있게 export 한다. 피커·온보딩 스텝이
// `getCharacterPickerRoster` 의 catch 에서 이것을 통과시켜 loadError 로 내려준다.
export function toScheduleSyncError(error: unknown, apiKey?: string): ScheduleSyncError {
  const 실은키 = apiKey === undefined ? {} : { apiKey }
  // 401/403 만이 아니라 400 OPENAPI00005 도 무효 키다. 판정은 nexon/errors 한 곳.
  // **이 분기가 400 분기보다 앞이어야 한다**. 아래 NexonBadRequestError 검사에 먼저 걸리면
  // 00005 가 "모르는 400" 으로 network 에 흡수돼 원래 결함으로 되돌아간다.
  if (isInvalidApiKeyError(error)) {
    return { kind: 'invalidApiKey', ...실은키 }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited', ...실은키 }
  }
  // 200 인데 본문에 캐릭터가 없다(월드 이전으로 남겨진 ocid). 넥슨이 준 것은 00003 과 다르지만
  // 부르는 쪽의 처방은 같다 - 영구이고, 추적 중이면 해제 경로로 남긴다. 어휘를 늘리지 않는다.
  if (error instanceof NexonNoCharacterError) {
    return { kind: 'characterUnavailable', ...실은키 }
  }
  // 코드를 아는 400만 갈라내고, 모르는 코드·본문 없는 400은 network로 degrade한다.
  // 넥슨이 코드 체계를 바꿔도 최악의 경우 지금 동작(재시도 유도)으로 떨어지게 하는 안전판이다
  // (트레이드오프).
  if (error instanceof NexonBadRequestError) {
    if (error.code === 'OPENAPI00003') {
      return { kind: 'characterUnavailable', ...실은키 }
    }
    if (error.code === 'OPENAPI00004') {
      return { kind: 'periodOutOfRange', ...실은키 }
    }
    if (error.code === 'OPENAPI00009') {
      return { kind: 'notCollected', ...실은키 }
    }
  }
  return { kind: 'network', ...실은키 }
}
