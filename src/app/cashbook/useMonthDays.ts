/**
 * 가계부가 그리는 것을 **달 단위로 들고 있는 상태.** 보는 달과 그 앞뒤 둘, 다섯 달을 미리 읽는다.
 *
 * 한 달을 한 번 읽으면 **격자의 칸 금액과 그날 목록이 함께** 나온다(`loadMonthDays`). 전에는
 * 둘이 조회를 따로 가져, 날을 고를 때마다 이미 읽은 것을 하루 범위로 다시 읽었다.
 *
 * 읽는 단위가 격자 범위가 아니라 **달력 월**이다. 격자는 앞뒤 달 날짜로 빈칸을 채우지만 그 칸은
 * 금액을 안 그리므로(`CalendarGrid` 가 `inPeriod` 로 거른다) 읽어 봐야 버린다. 달로 끊으면
 * 이웃 격자와 겹치는 부분도 한 번만 읽는다.
 *
 * @example
 * const months = useMonthDays({ viewMonthKey, todayMonthKey, stamp, paused: ledger.collecting })
 * <CalendarGrid amounts={months.amounts} … />
 * const rows = months.recordsOn(selectedDateKey)
 */
import { useEffect, useState } from 'react'

import { monthBounds, monthKeyOf, type CalendarAmounts } from '../../lib/calendar'
import { amountsOfDays, loadMonthDays, type DayRecord } from '../../features/cashbook/records'
import { monthWindow } from '../../features/cashbook/range'

interface MonthEntry {
  /** 날짜에서 그날 줄들로. 아무것도 없는 날은 아예 키가 없다 */
  byDate: Readonly<Record<string, DayRecord[]>>
  /**
   * **어느 판에서 읽었나.** 기록이 바뀌거나(`reloadToken`) 층이 한 회차를 끝내면
   * (`ledger.revision`) 지금 판이 달라지고, 그때 이 줄은 다시 읽을 대상이 된다.
   */
  stamp: string
}

type MonthCache = ReadonlyMap<string, MonthEntry>

const EMPTY: MonthCache = new Map()
const NO_RECORDS: DayRecord[] = []

/**
 * 다시 읽어야 할 달 하나. 없으면 `null`. 안 읽었거나 **옛 판에서 읽은** 달이다.
 *
 * 한 번에 하나만 돌려주는 것은 효과가 **자기가 채운 표를 다시 보고** 다음 달로 넘어가게 하기
 * 위해서다. 한 효과 안에서 다섯을 이어 읽으면 도중에 달을 옮겨도 앞의 회차가 계속 돈다.
 */
export function nextStaleMonth(
  window: readonly string[],
  cache: MonthCache,
  stamp: string,
): string | null {
  return window.find((key) => cache.get(key)?.stamp !== stamp) ?? null
}

export function useMonthDays(input: {
  viewMonthKey: string
  todayMonthKey: string
  /** 이 표가 어느 판의 것인가. 달라지면 통째로 다시 읽는다 */
  stamp: string
  /** 층이 채우는 중인가. 그동안은 안 읽는다 */
  paused: boolean
}): {
  /** 격자가 읽는 칸 금액. 들고 있는 달을 다 합친 표다 */
  amounts: CalendarAmounts
  /** 그날 줄들. 그 달을 안 들고 있으면 `null` 이고 부르는 쪽이 따로 읽는다 */
  recordsOn: (dateKey: string) => DayRecord[] | null
  /** 그 달을 들고 있나. **옛 판의 값이라도 참**이다. 그리는 데는 쓸 수 있다 */
  has: (monthKey: string) => boolean
} {
  const [cache, setCache] = useState<MonthCache>(EMPTY)
  const { viewMonthKey, todayMonthKey, stamp, paused } = input

  /**
   * **한 달씩 읽는다.** 읽고 나면 `cache` 가 바뀌어 이 효과가 다시 돌고 그다음 달로 넘어간다.
   *
   * 회차가 도는 동안은 안 읽는다. 그때의 DB 는 자라는 중이라 한 칸의 값이 종류가 도착할 때마다
   * 커진다(큐브 → 스타포스 → 잠재). 이미 읽어 둔 달을 **그리는 것**은 막지 않는다.
   */
  useEffect(() => {
    if (paused) return
    const stale = nextStaleMonth(monthWindow(viewMonthKey, todayMonthKey), cache, stamp)
    if (stale === null) return

    let alive = true
    const { from, to } = monthBounds(stale)
    void loadMonthDays(from, to).then((byDate) => {
      if (!alive) return
      setCache((current) => new Map(current).set(stale, { byDate, stamp }))
    })
    return () => {
      alive = false
    }
  }, [viewMonthKey, todayMonthKey, stamp, paused, cache])

  /**
   * **옛 판의 값도 그린다.** 판이 바뀔 때마다 표를 비우면 층이 회차를 끝낼 때마다 격자가
   * 한 번씩 하얘진다. 그 자리에 옛 숫자를 세워 두고 새 값이 오면 갈아 끼운다. 어긋나는 것은
   * 한 회차 분이고 몇백 밀리초 뒤에 스스로 맞는다.
   */
  const amounts: CalendarAmounts = Object.assign(
    {},
    ...[...cache.values()].map((entry) => amountsOfDays(entry.byDate)),
  )

  return {
    amounts,
    recordsOn: (dateKey) => {
      const entry = cache.get(monthKeyOf(dateKey))
      return entry === undefined ? null : (entry.byDate[dateKey] ?? NO_RECORDS)
    },
    has: (monthKey) => cache.has(monthKey),
  }
}
