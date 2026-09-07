/**
 * 화면이 그리는 데이터가 언제 것인가 를 적는 한 줄의 표기.
 *
 * **절대 시각이다.** `12분 전` 같은 상대 표기는 화면을 보고 있는 동안 계속 틀려지는데 그 줄을
 * 다시 그리지 않는다. 절대 시각은 한 번 적으면 안 늙는다.
 *
 * 날짜는 안 적는다(사용자 지정). 어제 받은 데이터도 `14:03:22 기준` 이 된다.
 */

/** 두 자리로. `9` 가 아니라 `09` 여야 자리가 안 흔들린다. */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * `14:03:22 기준`. 받은 적이 없거나 못 읽는 값이면 **빈 문자열**.
 *
 * 빈 문자열을 내는 것이 계약이다. 부르는 쪽이 그것으로 줄을 통째로 뺀다.
 *
 * @param fetchedAt ISO 8601. 기기 표준시로 그린다
 */
export function formatFetchedAt(fetchedAt: string | null | undefined): string {
  if (fetchedAt === null || fetchedAt === undefined) return ''

  const date = new Date(fetchedAt)
  if (Number.isNaN(date.getTime())) return ''

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} 기준`
}

/**
 * 여럿 중 가장 최근 것. 전부 비었으면 `null`.
 *
 * **화면이 그리는 데이터의 시각을 그대로 읽는 자리다.** 화면이 자기 시계로 지금 을 적으면
 * 조회가 TTL 에 막혀 한 번도 안 나간 진입에도 시각이 갱신되고, 같은 한 번의 조회로 그린
 * 데이터인데 페이지마다 값이 갈린다(실사용에서 1초 차이로 드러났다).
 *
 * 못 읽는 값은 버린다. 서버나 캐시가 이상한 값을 줘도 나머지로 답한다.
 */
export function latestSyncedAt(values: readonly (string | null | undefined)[]): string | null {
  let best: string | null = null
  let bestMs = Number.NEGATIVE_INFINITY

  for (const value of values) {
    if (value === null || value === undefined) continue
    const ms = new Date(value).getTime()
    if (Number.isNaN(ms) || ms <= bestMs) continue
    best = value
    bestMs = ms
  }

  return best
}
