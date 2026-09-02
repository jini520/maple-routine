// 초기화 카운트다운 위젯([[ADR-147]] 결정 6 · 정정 13·39). 이 파일이 지키는 것 넷 —
// ① **일일은 초까지 세고 1초마다 다시 그린다**(기준은 `atMs` — 틱을 세지 않는다)
// ② **크기마다 무엇을 버리는지**(2x1 은 월간 · 1x1 은 일일만 + 단위 하나)
// ③ **임박을 색으로 말하지 않는다**(값이 무엇이든 글자 스타일이 같다 — 색이 확정되지 않았다)
// ④ **누를 수 없는 타일이다**(목적지가 없다 — 초기화 시각은 이 타일이 다 말한다)
//
// **네 크기를 전부 스냅샷으로 찍는다** — v1 배치가 쓰는 것은 2x1 하나뿐이라(정정 13) 나머지 셋은
// 아무도 안 부르는 렌더 분기이고, 그 분기의 유일한 안전망이 스냅샷이다.

import { act } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../../components/__tests__/render-atom'
import { ResetCountdownWidget } from '../ResetCountdownWidget'
import { WIDGET_BY_ID } from '../registry'
import { 뷰모델, 초기화 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'
import type { WidgetHeight } from '../../../../lib/today/widget-layout'

const 크기 = {
  '2x1': { w: 2, h: 1 },
  '2x2': { w: 2, h: 2 },
  '4x1': { w: 4, h: 1 },
  '1x1': { w: 1, h: 1 },
} as const

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// 위젯이 `Date.now()` 를 읽으므로(정정 39) 시계를 고정한다. 픽스처의 `atMs` 가 곧 «남은 ms» 라
// (`카운트다운` 이 그렇게 만든다) **`now` 를 0 으로 두면 `atMs − 0` 이 그대로 남은 시간**이 된다.
beforeEach(() => {
  jest.useFakeTimers({ now: 0 })
})

afterEach(() => {
  jest.useRealTimers()
})

/** 셋이 서로 다른 단위로 접히는 값 — 일일 `12시간 34분` · 주간 `2일 12시간` · 월간 `13일 12시간`. */
const 기본 = 뷰모델({
  resets: 초기화(
    12 * HOUR_MS + 34 * MINUTE_MS,
    2 * DAY_MS + 12 * HOUR_MS,
    13 * DAY_MS + 12 * HOUR_MS,
  ),
})

async function 위젯(
  값: { w: number; h: WidgetHeight },
  data: TodayViewModel = 기본,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<ResetCountdownWidget w={값.w} h={값.h} data={data} />)
}

describe('남은 시간 표기', () => {
  it.each(Object.entries(크기))('%s — 일일은 어느 크기에서나 선다', async (_이름, 값) => {
    const { getByTestId } = await 위젯(값)

    expect(getByTestId('reset-value-daily')).toBeTruthy()
  })

  it('일일은 초까지 센다 ([[ADR-147]] 정정 39)', async () => {
    const { getByText } = await 위젯(크기['2x1'])

    expect(getByText('12시간 34분 0초')).toBeTruthy()
  })

  it('주간·월간은 분까지다 — 수십 시간 남은 값에 초를 붙이면 글자만 길어진다', async () => {
    const { getByText } = await 위젯(크기['2x2'])

    expect(getByText('2일 12시간')).toBeTruthy()
    expect(getByText('13일 12시간')).toBeTruthy()
  })

  it('앞의 0 단위는 뗀다 — `0시간 43분 12초` 가 아니다', async () => {
    const { getByText } = await 위젯(
      크기['2x1'],
      뷰모델({ resets: 초기화(43 * MINUTE_MS + 12 * 1000, DAY_MS, DAY_MS) }),
    )

    expect(getByText('43분 12초')).toBeTruthy()
  })

  it('한 시간이 안 남으면 주간은 분만 남는다', async () => {
    const { getByText } = await 위젯(
      크기['2x1'],
      뷰모델({ resets: 초기화(DAY_MS, 43 * MINUTE_MS, DAY_MS) }),
    )

    expect(getByText('43분')).toBeTruthy()
  })

  // 아직 안 왔다는 사실이 «0분» 으로 읽히면 안 된다 — 다만 **초를 그리는 일일에는 안 쓴다**.
  it('«1분 미만» 은 주간·월간에만 남는다 — 일일은 `20초` 라고 직접 말한다', async () => {
    const { getByText, queryByText } = await 위젯(
      크기['2x1'],
      뷰모델({ resets: 초기화(20 * 1000, 20 * 1000, DAY_MS) }),
    )

    expect(getByText('20초')).toBeTruthy()
    expect(getByText('1분 미만')).toBeTruthy()
    expect(queryByText('0분')).toBeNull()
  })

  it('숫자 폭이 흔들리지 않게 `tabular-nums` 를 건다', async () => {
    const { getByTestId } = await 위젯(크기['2x1'])

    expect(getByTestId('reset-value-daily').props.style).toMatchObject({
      fontVariant: ['tabular-nums'],
    })
  })
})

describe('크기가 버리는 것 ([[ADR-147]] 정정 13)', () => {
  // 월간은 대개 멀어 지금 급한 것이 아니다.
  it('2x1 은 일일·주간 두 줄이고 월간이 없다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(크기['2x1'])

    expect(getByTestId('reset-row-daily')).toBeTruthy()
    expect(getByTestId('reset-row-weekly')).toBeTruthy()
    expect(queryByTestId('reset-row-monthly')).toBeNull()
  })

  it('2x2 는 셋을 다 세우고 각각 진행 바를 단다', async () => {
    const { getAllByTestId, getByTestId } = await 위젯(크기['2x2'])

    expect(getByTestId('reset-row-monthly')).toBeTruthy()
    expect(getAllByTestId('reset-bar-fill')).toHaveLength(3)
  })

  it('2x1 에는 진행 바가 없다', async () => {
    const { queryByTestId } = await 위젯(크기['2x1'])

    expect(queryByTestId('reset-bar-fill')).toBeNull()
  })

  it('4x1 은 셋을 가로로 세운다', async () => {
    const { getAllByTestId, queryByTestId } = await 위젯(크기['4x1'])

    expect(getAllByTestId(/^reset-cell-/)).toHaveLength(3)
    expect(queryByTestId('reset-bar-fill')).toBeNull()
  })

  it('1x1 은 일일만 남고 값이 가장 큰 단위 하나로 접힌다', async () => {
    const { getByText, queryByTestId } = await 위젯(크기['1x1'])

    expect(getByText('12시간')).toBeTruthy()
    expect(queryByTestId('reset-value-weekly')).toBeNull()
    expect(queryByTestId('reset-value-monthly')).toBeNull()
  })
})

describe('진행 바 — 주기의 어디쯤인가', () => {
  it('지난 몫만큼 찬다', async () => {
    const { getAllByTestId } = await 위젯(
      크기['2x2'],
      // 하루 중 6시간 남음 = 75% 지났다.
      뷰모델({ resets: 초기화(6 * HOUR_MS, 7 * DAY_MS, 31 * DAY_MS) }),
    )

    expect(flattenStyle(getAllByTestId('reset-bar-fill')[0].props.style).width).toBe('75%')
  })

  // 달마다 길이가 다르므로(28~31일) 분모를 위젯이 상수로 들 수 없다 — 뷰모델이 함께 준다.
  it('월간은 그 달의 길이를 분모로 쓴다', async () => {
    const { getAllByTestId } = await 위젯(
      크기['2x2'],
      뷰모델({
        resets: {
          // 남은 시간은 이제 `atMs − 지금`(= atMs, 시계가 0 이므로)에서 나온다([[ADR-147]] 정정 39).
          daily: { atMs: 0, remainingMs: 0, periodMs: DAY_MS },
          weekly: { atMs: 0, remainingMs: 0, periodMs: 7 * DAY_MS },
          monthly: { atMs: 14 * DAY_MS, remainingMs: 14 * DAY_MS, periodMs: 28 * DAY_MS },
        },
      }),
    )

    expect(flattenStyle(getAllByTestId('reset-bar-fill')[2].props.style).width).toBe('50%')
  })
})

describe('임박을 색으로 말하지 않는다', () => {
  // `error` 는 실패의 색이라 임박에 빌리면 그 뜻이 흐려진다 — 색이 확정될 때까지 스타일이 안 갈린다.
  it('1분 미만이어도 글자 스타일이 여유 있을 때와 같다', async () => {
    const 여유 = await 위젯(크기['2x1'])
    const 임박 = await 위젯(크기['2x1'], 뷰모델({ resets: 초기화(20 * 1000, DAY_MS, DAY_MS) }))

    expect(임박.getByTestId('reset-value-daily').props.className).toBe(
      여유.getByTestId('reset-value-daily').props.className,
    )
  })
})

describe('누를 수 없는 타일이다', () => {
  // 초기화 시각은 이 타일이 다 말하고 더 볼 화면이 없다 — 갈 데 없는 것을 누르게 두면 무반응이
  // «고장» 으로 읽힌다(격자가 `target` 없는 타일을 `Pressable` 로 감싸지 않는 것이 그 계약이다).
  it('레지스트리에 목적지가 없다', () => {
    expect(WIDGET_BY_ID['reset-countdown'].target).toBeUndefined()
  })
})

describe('1초마다 다시 그린다 ([[ADR-147]] 정정 39)', () => {
  it('1초가 지나면 일일이 1초 줄어든다', async () => {
    const { getByTestId } = await 위젯(크기['2x1'])

    expect(getByTestId('reset-value-daily').props.children).toBe('12시간 34분 0초')

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    // `atMs` 는 그대로이고 «지금» 만 흘렀다 — 값이 그 차에서 나온다.
    expect(getByTestId('reset-value-daily').props.children).toBe('12시간 33분 59초')
  })

  // **틱을 세지 않는다.** 백그라운드에서 타이머가 눌려 몇 번을 못 세도, 절대 시각에서 빼면 다음
  // 렌더가 맞는 값을 준다 — 틱 수로 세면 그만큼 조용히 뒤처진다.
  it('타이머가 눌려 한 번만 깨어나도 흐른 만큼 줄어든다', async () => {
    const { getByTestId } = await 위젯(크기['2x1'])

    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000)
    })

    expect(getByTestId('reset-value-daily').props.children).toBe('12시간 24분 0초')
  })

  it('0 밑으로 내려가지 않는다 — 지난 시각을 음수로 말하지 않는다', async () => {
    const { getByTestId } = await 위젯(
      크기['2x1'],
      뷰모델({ resets: 초기화(2 * 1000, DAY_MS, DAY_MS) }),
    )

    await act(async () => {
      jest.advanceTimersByTime(10 * 1000)
    })

    expect(getByTestId('reset-value-daily').props.children).toBe('0초')
  })

  // 걷지 않으면 화면을 떠난 뒤에도 1초마다 상태를 갱신한다(경고와 누수). 남은 타이머 «수» 는
  // 테마·애니메이션 것이 섞여 못 세므로, **우리가 만든 그 id 가 걷혔는가** 를 묻는다.
  it('언마운트하면 자기 타이머를 걷는다', async () => {
    const 건다 = jest.spyOn(globalThis, 'setInterval')
    const 걷는다 = jest.spyOn(globalThis, 'clearInterval')

    const view = await 위젯(크기['2x1'])
    const 내_아이디 = 건다.mock.results.map((결과) => 결과.value)
    await act(async () => {
      view.unmount()
    })
    const 걷힌_아이디 = 걷는다.mock.calls.map(([아이디]) => 아이디)

    expect(내_아이디.length).toBeGreaterThan(0)
    expect(내_아이디.some((아이디) => 걷힌_아이디.includes(아이디))).toBe(true)

    건다.mockRestore()
    걷는다.mockRestore()
  })
})

describe('KST 기준이다 ([[ADR-147]] 정정 39)', () => {
  // 뷰모델이 KST 절대 시각을 주고 이 위젯은 빼기만 한다 — 기기 타임존이 끼어들 자리가 없다.
  // 그 계약을 «타임존을 바꿔도 같은 글자» 로 검사한다(`Date.now()` 는 타임존과 무관한 epoch 다).
  it('기기 타임존이 달라도 같은 값을 그린다', async () => {
    const 원래 = process.env.TZ
    const 결과: string[] = []

    for (const tz of ['Asia/Seoul', 'UTC', 'America/New_York']) {
      process.env.TZ = tz
      const { getByTestId } = await 위젯(크기['2x1'])
      결과.push(String(getByTestId('reset-value-daily').props.children))
    }

    process.env.TZ = 원래
    expect(new Set(결과).size).toBe(1)
  })
})
