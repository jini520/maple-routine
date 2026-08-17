// 아이템 드롭 가뭄 위젯([[ADR-071]] 결정 9 · [[ADR-146]] 정정 6·10·13·14). 이 파일이 지키는 것 다섯 —
// ① **요약이 없으면 「아직 기록이 없습니다」**(0주째로 위장하지 않는다 — 안 먹은 것과 안 적은 것은
//    다르고, 0주는 «이번 주에 먹었다» 는 **정반대**의 사실이다)
// ② **잎의 각도·투명도가 `getValuableDroughtTier` 를 따른다**(단계 표는 히스토리 화면과 한 벌이다)
// ③ **0단계만 배경이 바뀐다** — 격자에서 유일하게 축하하는 타일이다
// ④ **문구는 마운트당 한 번** 고른다(렌더마다 고르면 리렌더 때 깜빡인다)
// ⑤ **「물욕」이라는 말을 쓰지 않는다**(정정 14)
//
// **세 크기를 전부 스냅샷으로 찍는다** — v1 배치가 쓰는 것은 4x1 하나뿐이라(정정 13) 나머지 둘은
// 아무도 안 부르는 렌더 분기이고, 그 분기의 유일한 안전망이 스냅샷이다.

import { getValuableDroughtTier } from '@core/lib/drop-history'
import { act } from '@testing-library/react-native'

import {
  findAllOfType,
  flattenStyle,
  renderAtom,
  기본테마,
} from '../../../../components/__tests__/render-atom'
import { DROUGHT_TIER_STYLES } from '../../../../lib/drought-tier-styles'
import { ThemeProvider } from '../../../../theme/ThemeProvider'
import { ValuableDroughtWidget } from '../ValuableDroughtWidget'
import { 가뭄, 뷰모델, 빈_뷰모델 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'
import type { WidgetHeight } from '../../../../lib/widget-layout'

const 크기 = {
  '4x1': { w: 4, h: 1 },
  '2x2': { w: 2, h: 2 },
  '2x1': { w: 2, h: 1 },
} as const

const 삼주째 = 뷰모델({ drought: 가뭄(3) })

async function 위젯(
  값: { w: number; h: WidgetHeight },
  data: TodayViewModel = 삼주째,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<ValuableDroughtWidget w={값.w} h={값.h} data={data} />)
}

function 모든글자(view: Awaited<ReturnType<typeof renderAtom>>): string {
  return findAllOfType(view.toJSON(), 'Text')
    .flatMap((node) => (node.children ?? []).filter((child) => typeof child === 'string'))
    .join('|')
}

function 잎스타일(view: Awaited<ReturnType<typeof renderAtom>>): Record<string, unknown> {
  const leaf = findAllOfType(view.toJSON(), 'View').find(
    (node) => node.props?.testID === 'drought-leaf',
  )
  return (leaf?.props?.style ?? {}) as Record<string, unknown>
}

describe('요약이 없을 때 ([[ADR-071]] — 기준점이 없으면 `null`)', () => {
  // 「0주째」로 위장하면 «이번 주에 먹었다» 는 정반대의 사실이 된다.
  it.each(Object.entries(크기))('%s — 0주째가 아니라 「기록이 없습니다」', async (_이름, 값) => {
    const view = await 위젯(값, 빈_뷰모델)

    expect(view.getByText('아직 아이템 드롭 기록이 없습니다')).toBeTruthy()
    expect(모든글자(view)).not.toContain('주째')
    expect(view.queryByTestId('drought-headline')).toBeNull()
  })

  it('타일은 남는다 — 좌표 배치라 빼면 빈 사각형이다', async () => {
    const { getByTestId } = await 위젯(크기['4x1'], 빈_뷰모델)

    expect(getByTestId('widget-valuable-drought')).toBeTruthy()
  })
})

describe('잎은 단계를 따라 늙는다 ([[ADR-071]] 결정 9)', () => {
  // 뷰모델의 `tier` 가 `getValuableDroughtTier` 의 값이고, 위젯은 그 첨자로 표를 읽는다.
  it.each([0, 1, 2, 3, 7])('%i주째 — 각도·투명도가 그 단계의 값이다', async (weeksSince) => {
    const 기대 = DROUGHT_TIER_STYLES[getValuableDroughtTier(weeksSince)]

    const style = 잎스타일(await 위젯(크기['4x1'], 뷰모델({ drought: 가뭄(weeksSince) })))

    expect(style.transform).toEqual([{ rotate: `${기대.rotate}deg` }])
    expect(style.opacity).toBe(기대.opacity)
  })

  // 0단계만 글로우가 붙는다 — 기쁨의 기준점이 없으면 아래 단계가 슬픔이 아니라 그냥 흐린 UI다.
  it('0주째만 글로우가 있다', async () => {
    expect(잎스타일(await 위젯(크기['4x1'], 뷰모델({ drought: 가뭄(0) }))).filter).toBeDefined()
    expect(잎스타일(await 위젯(크기['4x1'], 뷰모델({ drought: 가뭄(2) }))).filter).toBeUndefined()
  })
})

describe('0주째만 배경이 바뀐다 — 격자에서 유일하게 축하하는 타일', () => {
  // 기대값은 테마에서 읽는다([[ADR-006]] — 테스트가 색을 베끼면 두 벌이 된다).
  it.each(Object.entries(크기))('%s — 0주째는 `primary-tint`', async (_이름, 값) => {
    const { getByTestId } = await 위젯(값, 뷰모델({ drought: 가뭄(0) }))

    expect(flattenStyle(getByTestId('widget-valuable-drought').props.style).backgroundColor).toBe(
      기본테마.primaryTint,
    )
  })

  it.each([1, 3, 9])('%i주째는 배경을 칠하지 않는다', async (weeksSince) => {
    const { getByTestId } = await 위젯(크기['4x1'], 뷰모델({ drought: 가뭄(weeksSince) }))

    expect(
      flattenStyle(getByTestId('widget-valuable-drought').props.style).backgroundColor,
    ).toBeUndefined()
  })
})

describe('크기마다 버리는 것', () => {
  it('4x1 은 마지막 기간과 아이템을 함께 말한다', async () => {
    const { getByText } = await 위젯(크기['4x1'])

    expect(getByText('마지막 · 7월 3주차 · 생명의 연마석 외 1개')).toBeTruthy()
  })

  // 아직 진행 중인 주를 «마지막» 이라 부르면 어색하다(히스토리 화면과 같은 규칙).
  it('0주째의 4x1 에는 「마지막」이 없다', async () => {
    const { getByText } = await 위젯(크기['4x1'], 뷰모델({ drought: 가뭄(0) }))

    expect(getByText('7월 3주차 · 생명의 연마석 외 1개')).toBeTruthy()
  })

  it('2x2 는 마지막 기간 줄을 버리고 상태 한 줄만 남긴다', async () => {
    const view = await 위젯(크기['2x2'])

    expect(view.getByText('3주째 아이템 드롭 없음')).toBeTruthy()
    expect(view.queryByTestId('drought-last')).toBeNull()
  })

  it('0주째의 2x2 는 «없음» 이 아니라 «있음» 을 말한다', async () => {
    const { getByText } = await 위젯(크기['2x2'], 뷰모델({ drought: 가뭄(0) }))

    expect(getByText('이번 주에 획득했습니다')).toBeTruthy()
  })

  it('2x1 은 기간 길이 칩만 남긴다', async () => {
    const view = await 위젯(크기['2x1'])

    expect(view.getByText('3주째')).toBeTruthy()
    expect(view.queryByTestId('drought-last')).toBeNull()
  })

  // 「0주째」는 셈은 맞지만 뜻이 없다 — 그 주에 먹었다는 것이 0주의 정의다.
  it('0주째 칩은 「이번 주」다', async () => {
    const { getByText, queryByText } = await 위젯(크기['2x1'], 뷰모델({ drought: 가뭄(0) }))

    expect(getByText('이번 주')).toBeTruthy()
    expect(queryByText('0주째')).toBeNull()
  })
})

describe('문구는 마운트당 한 번 고른다 ([[ADR-146]] 정정 6)', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('리렌더에도 안 바뀐다 — 렌더마다 고르면 깜빡인다', async () => {
    // 부를 때마다 답이 달라지는 시계 — 렌더 본문에서 부르면 문구가 매 렌더 갈린다.
    const 값들 = [0, 0.99, 0.5]
    let 회차 = 0
    const random = jest.spyOn(Math, 'random').mockImplementation(() => 값들[회차++ % 값들.length])

    const view = await 위젯(크기['4x1'])
    const 처음 = view.getByTestId('drought-headline').props.children

    // 두 가지가 다 필요하다 —
    // ① `renderAtom` 과 **같은 트리 모양**(프로바이더를 빼면 위젯이 통째로 다시 마운트되는데,
    //    그러면 문구가 다시 뽑히는 것이 정상이라 이 테스트가 아무것도 못 묻는다)
    // ② **`act`** — 이 런타임에서 `rerender` 만 부르면 커밋이 안 나 컴포넌트가 다시 불리지 않는다
    //    (실측: 이것 없이는 «렌더마다 무작위» 로 되돌려도 테스트가 초록으로 남았다).
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <ValuableDroughtWidget w={4} h={1} data={삼주째} />
        </ThemeProvider>,
      )
    })

    expect(view.getByTestId('drought-headline').props.children).toBe(처음)
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('인덱스는 그 단계의 풀 안에서만 고른다', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999)

    const view = await 위젯(크기['4x1'])

    // 3주 단계의 풀([[ADR-146]] 정정 10) — 어느 것이 나오든 그 둘 중 하나다.
    expect(['선넘네?!', '이게 억까지 뭐야']).toContain(
      view.getByTestId('drought-headline').props.children,
    )
  })
})

// 정정 14 — 화면에 보이는 한국어는 「아이템 드롭」이다. 영문 식별자는 그대로 두므로 이 검사는
// **렌더 결과**에만 건다.
describe('「물욕」을 쓰지 않는다 ([[ADR-146]] 정정 14)', () => {
  it.each(Object.entries(크기))('%s — 어디에도 없다', async (_이름, 값) => {
    expect(모든글자(await 위젯(값))).not.toContain('물욕')
  })

  it('기록이 없을 때도 없다', async () => {
    expect(모든글자(await 위젯(크기['2x2'], 빈_뷰모델))).not.toContain('물욕')
  })
})

describe('세 크기 스냅샷 — 아무도 안 부르는 분기의 유일한 안전망', () => {
  beforeEach(() => {
    // 문구가 무작위라 그대로 찍으면 스냅샷이 실행마다 갈린다 — 인덱스를 0으로 고정한다.
    jest.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each(Object.entries(크기))('%s', async (_이름, 값) => {
    const { toJSON } = await 위젯(값)

    expect(toJSON()).toMatchSnapshot()
  })
})
