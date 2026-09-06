/**
 * 동시에 나가는 호출 수를 묶는 게이트.
 *
 * 첫 진입이 캐릭터 6명 × 14일 = **84건**이다. 한꺼번에 쏘면 429 가 오고, 그 날짜는 원장에 안
 * 적혀 다음 방문에 다시 부른다. 죽지는 않지만 첫 진입이 계속 안 채워진다.
 *
 * 넥슨 키는 단계로 한도가 갈린다(개발 초당 5건 · 서비스 초당 500건). 앱이 개발 단계 키를
 * 로그인에서 막지만, 프로브가 통과시킨 10건 동시가 84건을 보장하지는 않는다.
 */

/**
 * 동시 실행이 `limit` 을 넘지 않게 `task` 를 돌린다. 결과는 **입력 순서** 그대로다.
 *
 * 던진 자리는 `undefined` 로 남고 나머지는 계속 나간다. 한 날짜의 실패가 그 회차 전체를
 * 멈추면 안 되기 때문이다.
 *
 * @param limit 1 이상. 배열 길이보다 커도 된다
 * @param onDone 작업 하나가 끝날 때마다 **끝난 수**를 받는다. 진행률의 분자이고 실패도 센다
 * @example const seen = await mapWithLimit(days, 6, (day) => probe(day))
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  onDone?: (done: number) => void,
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length)
  let next = 0
  let done = 0

  async function worker(): Promise<void> {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      try {
        results[index] = await task(items[index], index)
      } catch {
        results[index] = undefined
      }
      done += 1
      onDone?.(done)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, () => worker()),
  )
  return results
}
