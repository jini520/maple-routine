// 초기화 카운트다운 위젯. 이 파일이 지키는 것 셋.
// ① **일일은 초까지 세고 1초마다 다시 그린다**(기준은 `atMs`. 틱을 세지 않는다)
// ② **일일 · 주간 두 줄이고 월간은 없다**(월간은 대개 멀어 지금 급한 것이 아니다)
// ③ **임박을 색으로 말하지 않는다**(값이 무엇이든 글자 스타일이 같다. 색이 확정되지 않았다)

import { act } from '@testing-library/react-native'

import { renderAtom } from '../../../../components/__tests__/render-atom'
import { ResetCountdownWidget } from '../ResetCountdownWidget'
import { 뷰모델, 초기화 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// 위젯이 `Date.now` 를 읽으므로 시계를 고정한다. 픽스처의 `atMs` 가 곧 **남은 ms** 라
// (`카운트다운` 이 그렇게 만든다) **`now` 를 0 으로 두면 `atMs − 0` 이 그대로 남은 시간**이 된다.
beforeEach(() => {
  jest.useFakeTimers({ now: 0 })
})

afterEach(() => {
  jest.useRealTimers()
})

/** 셋이 서로 다른 단위로 접히는 값. 일일 `12시간 34분`· 주간 `2일 12시간`· 월간 `13일 12시간`. */
const 기본 = 뷰모델({
  resets: 초기화(
    12 * HOUR_MS + 34 * MINUTE_MS,
    2 * DAY_MS + 12 * HOUR_MS,
    13 * DAY_MS + 12 * HOUR_MS,
  ),
})

async function 위젯(data: TodayViewModel = 기본): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<ResetCountdownWidget data={data} />)
}

describe('남은 시간 표기', () => {
  it('일일은 초까지 센다', async () => {
    const { getByText } = await 위젯()

    expect(getByText('12시간 34분 0초')).toBeTruthy()
  })

  it('주간은 분까지다. 수십 시간 남은 값에 초를 붙이면 글자만 길어진다', async () => {
    const { getByText } = await 위젯()

    expect(getByText('2일 12시간')).toBeTruthy()
  })

  it('앞의 0 단위는 뗀다. `0시간 43분 12초` 가 아니다', async () => {
    const { getByText } = await 위젯(뷰모델({ resets: 초기화(43 * MINUTE_MS + 12 * 1000, DAY_MS, DAY_MS) }),
    )

    expect(getByText('43분 12초')).toBeTruthy()
  })

  it('한 시간이 안 남으면 주간은 분만 남는다', async () => {
    const { getByText } = await 위젯(뷰모델({ resets: 초기화(DAY_MS, 43 * MINUTE_MS, DAY_MS) }),
    )

    expect(getByText('43분')).toBeTruthy()
  })

  // 아직 안 왔다는 사실이 **0분** 으로 읽히면 안 된다. 다만 **초를 그리는 일일에는 안 쓴다**.
  it('**1분 미만** 은 주간·월간에만 남는다. 일일은 `20초` 라고 직접 말한다', async () => {
    const { getByText, queryByText } = await 위젯(뷰모델({ resets: 초기화(20 * 1000, 20 * 1000, DAY_MS) }),
    )

    expect(getByText('20초')).toBeTruthy()
    expect(getByText('1분 미만')).toBeTruthy()
    expect(queryByText('0분')).toBeNull()
  })

  it('숫자 폭이 흔들리지 않게 `tabular-nums` 를 건다', async () => {
    const { getByTestId } = await 위젯()

    expect(getByTestId('reset-value-daily').props.style).toMatchObject({
      fontVariant: ['tabular-nums'],
    })
  })
})

describe('줄', () => {
  // 월간은 대개 멀어 지금 급한 것이 아니다.
  it('일일 · 주간 두 줄이고 월간이 없다', async () => {
    const { getByTestId, queryByTestId } = await 위젯()

    expect(getByTestId('reset-row-daily')).toBeTruthy()
    expect(getByTestId('reset-row-weekly')).toBeTruthy()
    expect(queryByTestId('reset-row-monthly')).toBeNull()
  })
})

describe('임박을 색으로 말하지 않는다', () => {
  // `error` 는 실패의 색이라 임박에 빌리면 그 뜻이 흐려진다. 색이 확정될 때까지 스타일이 안 갈린다.
  it('1분 미만이어도 글자 스타일이 여유 있을 때와 같다', async () => {
    const 여유 = await 위젯()
    const 임박 = await 위젯(뷰모델({ resets: 초기화(20 * 1000, DAY_MS, DAY_MS) }))

    expect(임박.getByTestId('reset-value-daily').props.className).toBe(
      여유.getByTestId('reset-value-daily').props.className,
    )
  })
})

describe('1초마다 다시 그린다', () => {
  it('1초가 지나면 일일이 1초 줄어든다', async () => {
    const { getByTestId } = await 위젯()

    expect(getByTestId('reset-value-daily').props.children).toBe('12시간 34분 0초')

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    // `atMs` 는 그대로이고 **지금** 만 흘렀다. 값이 그 차에서 나온다.
    expect(getByTestId('reset-value-daily').props.children).toBe('12시간 33분 59초')
  })

  // **틱을 세지 않는다.** 백그라운드에서 타이머가 눌려 몇 번을 못 세도, 절대 시각에서 빼면 다음
  // 렌더가 맞는 값을 준다. 틱 수로 세면 그만큼 조용히 뒤처진다.
  it('타이머가 눌려 한 번만 깨어나도 흐른 만큼 줄어든다', async () => {
    const { getByTestId } = await 위젯()

    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000)
    })

    expect(getByTestId('reset-value-daily').props.children).toBe('12시간 24분 0초')
  })

  // 위젯은 받은 `atMs` 만 안다. 다음 주기로 넘기는 것은 화면이 경계에서 다시 렌더되는 일이고,
  // 그것은 `TodayScreen.test.tsx` 의 `초기화 경계` 가 본다. 여기는 그 렌더 전 한순간의 값이다.
  it('0 밑으로 내려가지 않는다. 지난 시각을 음수로 말하지 않는다', async () => {
    const { getByTestId } = await 위젯(뷰모델({ resets: 초기화(2 * 1000, DAY_MS, DAY_MS) }),
    )

    await act(async () => {
      jest.advanceTimersByTime(10 * 1000)
    })

    expect(getByTestId('reset-value-daily').props.children).toBe('0초')
  })

  // 걷지 않으면 화면을 떠난 뒤에도 1초마다 상태를 갱신한다(경고와 누수). 남은 타이머 **수** 는
  // 테마·애니메이션 것이 섞여 못 세므로, **우리가 만든 그 id 가 걷혔는가** 를 묻는다.
  it('언마운트하면 자기 타이머를 걷는다', async () => {
    const 건다 = jest.spyOn(globalThis, 'setInterval')
    const 걷는다 = jest.spyOn(globalThis, 'clearInterval')

    const view = await 위젯()
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

describe('KST 기준이다', () => {
  // 뷰모델이 KST 절대 시각을 주고 이 위젯은 빼기만 한다. 기기 타임존이 끼어들 자리가 없다.
  // 그 계약을 **타임존을 바꿔도 같은 글자** 로 검사한다(`Date.now` 는 타임존과 무관한 epoch 다).
  it('기기 타임존이 달라도 같은 값을 그린다', async () => {
    const 원래 = process.env.TZ
    const 결과: string[] = []

    for (const tz of ['Asia/Seoul', 'UTC', 'America/New_York']) {
      process.env.TZ = tz
      const { getByTestId } = await 위젯()
      결과.push(String(getByTestId('reset-value-daily').props.children))
    }

    process.env.TZ = 원래
    expect(new Set(결과).size).toBe(1)
  })
})
