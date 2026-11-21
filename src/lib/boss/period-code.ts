/**
 * 기록이 속한 기간의 값(`W202647` · `M202611` · `D20261119`)과 날짜로 적는 기간 key(`2026-11-19` · `2026-11`)를 오가는 함수.
 *
 * 기록 표와 서버는 기간 값을 쓰고 화면과 계산은 기간 key 를 쓴다. 기간 값의 첫 글자가 주기를 말하고, 주간의 번호는 그 주가
 * 시작한 목요일의 ISO 주 번호다. ISO 의 1주차가 그 해의 첫 목요일이 든 주이고, 주간 초기화가 KST 목요일 0시이기 때문이다.
 * 일간 값은 일간 공유 컨텐츠의 진행만 쓴다. 일간 key 와 주간 key 는 꼴이 같아서 일간 값은 따로 구한다.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 그 해 첫 목요일(UTC 자정 밀리초). */
function firstThursdayOf(year: number): number {
  const januaryFirst = Date.UTC(year, 0, 1)
  const weekday = new Date(januaryFirst).getUTCDay()
  return januaryFirst + ((4 - weekday + 7) % 7) * DAY_MS
}

/**
 * 기간 key 의 기간 값. 주간 key 는 목요일이어야 하고, 아니면 `null` 이다.
 *
 * @example periodCodeOf('2026-11-19') // 'W202647'
 */
export function periodCodeOf(periodKey: string): string | null {
  const monthly = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (monthly !== null) return `M${monthly[1]}${monthly[2]}`
  const weekly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey)
  if (weekly === null) return null
  const year = Number(weekly[1])
  const time = Date.UTC(year, Number(weekly[2]) - 1, Number(weekly[3]))
  if (new Date(time).getUTCDay() !== 4) return null
  return `W${year}${pad((time - firstThursdayOf(year)) / (7 * DAY_MS) + 1)}`
}

/**
 * 일간 key(KST 날짜)의 일간 기간 값. 꼴이 다르면 `null` 이다.
 *
 * @example dailyPeriodCodeOf('2026-11-19') // 'D20261119'
 */
export function dailyPeriodCodeOf(dateKey: string): string | null {
  const daily = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  return daily === null ? null : `D${daily[1]}${daily[2]}${daily[3]}`
}

/**
 * 기간 값의 기간 key. 꼴이 다르면 `null` 이다. 일간 값은 그 날짜다.
 *
 * @example periodKeyOfCode('W202647') // '2026-11-19'
 */
export function periodKeyOfCode(code: string): string | null {
  const monthly = /^M(\d{4})(\d{2})$/.exec(code)
  if (monthly !== null) return `${monthly[1]}-${monthly[2]}`
  const daily = /^D(\d{4})(\d{2})(\d{2})$/.exec(code)
  if (daily !== null) return `${daily[1]}-${daily[2]}-${daily[3]}`
  const weekly = /^W(\d{4})(\d{2})$/.exec(code)
  if (weekly === null) return null
  const date = new Date(firstThursdayOf(Number(weekly[1])) + (Number(weekly[2]) - 1) * 7 * DAY_MS)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}
