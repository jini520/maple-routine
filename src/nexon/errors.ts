export class NexonApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonApiError'
  }
}

export class NexonAuthError extends NexonApiError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonAuthError'
  }
}

export class NexonRateLimitError extends NexonApiError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonRateLimitError'
  }
}

export class NexonNetworkError extends NexonApiError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonNetworkError'
  }
}

/**
 * 400 Bad Request — **넥슨 에러 코드를 살려 담는다**([[ADR-067]] 결정 1).
 *
 * 400 하나에 성질이 전혀 다른 세 실패가 들어 있어서(실측 2026-07-31, foundation/nexon-api.md
 * "에러 코드") status만으로는 처방을 정할 수 없다:
 *   OPENAPI00003  조회할 수 없는 ocid — 영구. 재시도 무의미
 *   OPENAPI00004  그 ocid로 그 날짜를 조회할 수 없다 — 원인은 호출 측이 날짜로 판정한다
 *   OPENAPI00009  아직 집계 전 — 시간이 지나면 스스로 풀린다
 *
 * `code` 가 `null` 이면 본문을 읽지 못했거나 형태가 달라진 것이다 — 그때는 "알 수 없는 실패"로
 * degrade한다(넥슨이 코드 체계를 바꿔도 조용히 최악을 피하도록, [[ADR-067]] 트레이드오프).
 */
export class NexonBadRequestError extends NexonApiError {
  readonly code: string | null

  constructor(message: string, code: string | null, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonBadRequestError'
    this.code = code
  }
}

/**
 * **무효한 API 키인가** — [[ADR-115]] 결정 9. 이 판정은 여기 한 곳뿐이고
 * `toScheduleSyncError`·`toOnboardingError`·`toSettingsError` 셋이 첫 분기로 쓴다.
 *
 * `401`/`403` 만 보면 **실제 무효 키를 못 잡는다**. 넥슨은 무효한 키에 **400 `OPENAPI00005`**
 * (`"The apikey is not valid."`)를 준다 — 애초에 존재한 적 없는 키도, 한때 유효했다가 넥슨에서
 * 삭제된 키도 같은 응답이다(실측 2026-08-08, foundation/nexon-api.md "에러 코드"). 그전까지 이
 * 코드는 "모르는 400" 이라 `network` 로 degrade 됐고([[ADR-067]] 안전판), 그래서 키가 폐기된
 * 사용자에게 앱이 "네트워크 오류가 발생했습니다"만 반복해 말했다.
 *
 * 세 매퍼에 같은 조건을 복사하지 않는 이유: "무엇이 무효 키인가"는 **넥슨이 정하는 사실 하나**라
 * 판정도 하나여야 한다. 자리가 `nexon/` 인 것도 같은 이유다 — 동기화·온보딩·설정의 어휘가 아니라
 * API 의 성질이다.
 *
 * **다른 400 코드를 여기 넣지 마라** — `00003`(조회 불가 ocid)·`00004`(날짜)·`00009`(집계 전)는
 * 키와 무관하고([[ADR-067]] 결정 1), 무효 키로 오인하면 사용자를 엉뚱하게 키 입력 화면으로 보낸다.
 */
export function isInvalidApiKeyError(error: unknown): boolean {
  if (error instanceof NexonAuthError) {
    return true
  }
  return error instanceof NexonBadRequestError && error.code === 'OPENAPI00005'
}
