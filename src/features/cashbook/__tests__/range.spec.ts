// 가계부가 읽는 날짜 범위. 화면과 층이 **같은 범위**를 봐야 한다.
import {
  apiWindowRange,
  defaultCashbookRange,
  floorMonthKey,
  floorWeekStartKey,
  historyFloorDateKey,
  HISTORY_MONTHS_BACK,
  monthWindow,
  monthWindowRange,
  PREFETCH_RADIUS,
} from '../range'

describe('monthWindow: 채워 둘 달', () => {
  // **보는 달이 먼저**다. 그 달이 늦게 오면 옮긴 화면이 빈 채로 남는다.
  it('보는 달을 앞에 두고 가까운 순으로 넓힌다', () => {
    expect(monthWindow('2026-06', '2026-12')).toEqual([
      '2026-06',
      '2026-05',
      '2026-07',
      '2026-04',
      '2026-08',
      // 창 밖이어도 이번 달은 늘 든다. `오늘` 이 기다릴 자리를 없앤다.
      '2026-12',
    ])
  })

  it('앞뒤 둘씩에 이번 달을 더해 여섯이다', () => {
    expect(monthWindow('2026-06', '2026-12')).toHaveLength(PREFETCH_RADIUS * 2 + 2)
  })

  // 창 안에 이미 들어 있으면 두 번 넣지 않는다.
  it('이번 달이 창 안이면 그대로 다섯이다', () => {
    expect(monthWindow('2026-10', '2026-12')).toEqual([
      '2026-10',
      '2026-09',
      '2026-11',
      '2026-08',
      '2026-12',
    ])
  })

  /**
   * **이번 달보다 뒤는 안 채운다.** 그 뒤로는 화살표가 죽어 있어 갈 수 없고 채워 봐야 빈 표다.
   */
  it('이번 달이 천장이다', () => {
    expect(monthWindow('2026-08', '2026-08')).toEqual(['2026-08', '2026-07', '2026-06'])
  })

  it('해를 넘긴다', () => {
    expect(monthWindow('2026-01', '2026-12')).toEqual([
      '2026-01',
      '2025-12',
      '2026-02',
      '2025-11',
      '2026-03',
      '2026-12',
    ])
  })
})

/**
 * 층에 알리는 것은 **창 전체 하나의 범위**다. 보이는 격자만 알리면 이웃 달이 기기 DB 에 없는
 * 채로 남아, 옮겼을 때 그릴 것이 없다.
 */
describe('monthWindowRange: 층에 알리는 범위', () => {
  it('창의 첫 달 1일에서 마지막 달 말일까지다', () => {
    expect(monthWindowRange('2026-06', '2026-12')).toEqual({
      from: '2026-04-01',
      to: '2026-08-31',
    })
  })

  it('천장에 걸리면 그만큼 좁다', () => {
    expect(monthWindowRange('2026-08', '2026-08')).toEqual({
      from: '2026-06-01',
      to: '2026-08-31',
    })
  })
})

/**
 * 층이 마운트에서 쓰는 값이다. 화면이 첫 렌더에 알릴 범위와 **같아야** 층이 두 번째 회차를
 * 안 연다.
 */
describe('defaultCashbookRange', () => {
  it('이번 달과 그 앞 둘이다', () => {
    // KST 2026-08-23. UTC 로는 05:00 이라 날짜가 안 넘어간다.
    expect(defaultCashbookRange(new Date('2026-08-23T05:00:00Z'))).toEqual({
      from: '2026-06-01',
      to: '2026-08-31',
    })
  })

  it('화면이 이번 달에서 알리는 범위와 같다', () => {
    const now = new Date('2026-08-23T05:00:00Z')
    expect(defaultCashbookRange(now)).toEqual(apiWindowRange('2026-08', '2026-08-23'))
  })
})

/**
 * **Open API 로 거슬러 올라가는 한도.** 넥슨은 2년까지 주지만 앱은 1년 6개월로 끊는다.
 * 이미 받아 둔 날은 이 한도와 무관하다 - 기기 DB 에서 읽는다.
 */
describe('historyFloorDateKey', () => {
  it('1년 6개월이다', () => {
    expect(HISTORY_MONTHS_BACK).toBe(18)
  })

  /**
   * 오늘이 2026-09-10 이면 1년 6개월 전은 2025년 3월이다. 날짜(3/9)가 아니라 **그 달 1일이 든
   * 리셋 주의 목요일**이 한도다. 2025-03-01 은 토요일이라 그 주는 **2025-02-27(목)** 에 시작한다.
   */
  it('그 달 1일이 든 리셋 주의 목요일이다. 앞 달로 넘어갈 수 있다', () => {
    expect(historyFloorDateKey('2026-09-10')).toBe('2025-02-27')
  })

  // 1일이 목요일이면 그 날이 곧 주의 시작이라 그대로다.
  it('1일이 목요일이면 그 날이다', () => {
    // 2026-01-01 은 목요일이다. 그 18개월 뒤가 2027-07 이다.
    expect(historyFloorDateKey('2027-07-15')).toBe('2026-01-01')
  })
})

describe('apiWindowRange: 층에 알리는 범위', () => {
  it('한도 위에서는 창 그대로다', () => {
    expect(apiWindowRange('2026-08', '2026-09-10')).toEqual(monthWindowRange('2026-08', '2026-09'))
  })

  it('창이 한도 아래로 내려가면 한도에서 끊는다', () => {
    // 2025-03 을 보면 창은 2025-01-01 부터인데 한도가 2025-02-27 이다.
    expect(apiWindowRange('2025-03', '2026-09-10')).toEqual({
      from: '2025-02-27',
      to: '2025-05-31',
    })
  })

  /**
   * 한도 밖의 달은 화살표가 막아 앱에서는 안 나지만, 함수는 답을 내야 한다. 뒤집힌 범위를 주면
   * `datesBetween` 이 빈 목록을 낸다.
   */
  it('한도 밖의 달은 받을 날이 없다', () => {
    const range = apiWindowRange('2024-05', '2026-09-10')
    expect(range.from > range.to).toBe(true)
  })
})

/**
 * **한도 아래로는 못 간다**(사용자 지정). 그 아래에 기기 DB 의 기록이 남아 있어도 안 간다.
 * 새로 받을 길이 없어 반쪽만 채워진 달이 되고, 화면이 그것을 그 달의 전부처럼 말하게 된다.
 */
describe('갈 수 있는 바닥', () => {
  // 오늘이 2026-09 면 1년 6개월 전은 2025-03 이다. 월간은 거기서 멈춘다.
  it('월간의 바닥은 1년 6개월 전 그 달이다', () => {
    expect(floorMonthKey('2026-09')).toBe('2025-03')
  })

  /**
   * **주간이 며칠 더 간다.** 월간의 바닥이 3월이어도 주간은 2월 27일에 시작하는 그 한 주까지
   * 간다. 그 주가 3월 1일을 들고 있어서다.
   */
  it('주간의 바닥은 그 달 1일이 든 주라 앞 달에서 시작할 수 있다', () => {
    expect(floorWeekStartKey('2026-09')).toBe('2025-02-27')
  })

  it('조회 한도와 주간의 바닥이 같은 날이다', () => {
    expect(historyFloorDateKey('2026-09-10')).toBe(floorWeekStartKey('2026-09'))
  })
})
