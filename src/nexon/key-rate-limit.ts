/**
 * API 키로 넥슨을 직접 부를 때 키마다 1초에 내보내는 요청 수의 상한.
 *
 * 앱은 429 를 키 문제로 보고 그 키와 그 계정의 추적 캐릭터를 지운다. 그래서 서비스 단계 키가 한도(초당 500건)에 닿으면
 * 멀쩡한 키를 잃는다. 이 상한이 그 전제를 지킨다.
 *
 * 번들 개발자 키는 대상이 아니다. 모든 사용자가 함께 쓰는 키라 기기 하나의 상한으로는 지킬 수 없다.
 */

/** 키 하나가 1초에 내보내는 요청 수. 같은 키를 기기 여럿에서 써도 서비스 단계 한도에 닿지 않는 값이다. */
export const KEY_REQUESTS_PER_SECOND = 50

const WINDOW_MS = 1_000

/** 키마다 마지막 `KEY_REQUESTS_PER_SECOND` 건이 나간(또는 나갈) 시각. 늘 오름차순이다. */
const startsByKey = new Map<string, number[]>()

/**
 * 이 키로 요청 하나를 내보내도 될 때 풀리는 약속. 앞선 요청과 합쳐 어느 1초에도 상한을 넘지 않는 가장 이른 때다.
 *
 * 나갈 시각을 부르는 순간에 정해 둔다. 기다린 뒤에 세면 함께 기다리던 요청이 한꺼번에 풀려 상한을 넘는다.
 */
export function waitForKeySlot(apiKey: string): Promise<void> {
  const now = Date.now()
  const starts = startsByKey.get(apiKey) ?? []
  const oldest = starts.length >= KEY_REQUESTS_PER_SECOND ? starts[starts.length - KEY_REQUESTS_PER_SECOND] : undefined
  const at = oldest === undefined ? now : Math.max(now, oldest + WINDOW_MS)
  starts.push(at)
  if (starts.length > KEY_REQUESTS_PER_SECOND) starts.splice(0, starts.length - KEY_REQUESTS_PER_SECOND)
  startsByKey.set(apiKey, starts)

  const wait = at - now
  return wait <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, wait))
}

/** 테스트가 키마다 센 시각을 비운다. */
export function resetKeySlotsForTest(): void {
  startsByKey.clear()
}
