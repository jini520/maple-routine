/**
 * 사용자 API 키마다 마지막으로 조회에 성공한 시각. 429 다시 시도 모달이 연달아 받은 429 를 셀 때 그 사이에 성공했는지 본다.
 *
 * 기기에 남기지 않는다. 앱을 다시 켜면 처음부터 센다.
 */
const lastSuccessAt = new Map<string, number>()

/** 그 키로 부른 요청이 성공했다. `nexon/http.ts` 가 부른다. */
export function recordKeySuccess(apiKey: string): void {
  lastSuccessAt.set(apiKey, Date.now())
}

/** 그 키가 마지막으로 성공한 시각. 성공한 적이 없으면 `undefined`. */
export function lastKeySuccessAt(apiKey: string): number | undefined {
  return lastSuccessAt.get(apiKey)
}

export function resetKeySuccessForTest(): void {
  lastSuccessAt.clear()
}
