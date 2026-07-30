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
