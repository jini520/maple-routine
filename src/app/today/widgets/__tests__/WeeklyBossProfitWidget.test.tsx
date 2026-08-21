// 주간 보스 수익 위젯([[ADR-147]] 정정 4·13). 이 파일이 지키는 것 넷 —
// ① **증감이 없다**(칩도, 퍼센트도, `rise`/`fall` 색도 — 회귀 가드)
// ② **0 을 그리되 «없다» 로 읽히게 두지 않는다**(큰 `0 메소` + 미기록 한 줄, 이 위젯만의 예외)
// ③ **스택 바가 총액을 결정석/아이템으로 가른다**(폭이 비율이고 분해 금액이 그 색을 읽는 법을 말한다)
// ④ **크기가 버리는 것이 정해져 있다**(2x2 는 목록 · 4x2 는 행 내역 · 2x1 은 바까지)
//
// **네 크기를 전부 스냅샷으로 찍는다** — v1 배치가 쓰는 것은 4x3 하나뿐이라(정정 13) 나머지 셋은
// 아무도 안 부르는 렌더 분기이고, 그 분기의 유일한 안전망이 스냅샷이다.

import {
  renderAtom,
  findAllOfType,
  flattenStyle,
  기본테마,
} from '../../../../components/__tests__/render-atom'
import { WeeklyBossProfitWidget } from '../WeeklyBossProfitWidget'
import { 뷰모델, 빈_뷰모델, 수익, 수익캐릭터셋 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'
import type { WidgetHeight } from '../../../../lib/widget-layout'

const 크기 = {
  '4x3': { w: 4, h: 3 },
  '4x2': { w: 4, h: 2 },
  '2x2': { w: 2, h: 2 },
  '2x1': { w: 2, h: 1 },
} as const

const 기록있음 = 뷰모델({ profit: 수익(수익캐릭터셋()) })

async function 위젯(
  값: { w: number; h: WidgetHeight },
  data: TodayViewModel = 기록있음,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<WeeklyBossProfitWidget w={값.w} h={값.h} data={data} />)
}

/**
 * 트리 전체의 **글자와 색** — 회귀 가드가 «어디에도 없다» 를 묻는 데 쓴다.
 *
 * 스타일이 아니라 글자만 모으는 것이 요점이다: 스택 바의 폭이 `80.00%` 라 트리를 통째로 문자열로
 * 만들면 «퍼센트가 없다» 를 물을 수 없다.
 */
function 모든글자(view: Awaited<ReturnType<typeof renderAtom>>): string {
  return findAllOfType(view.toJSON(), 'Text')
    .flatMap((node) => (node.children ?? []).filter((child) => typeof child === 'string'))
    .join('|')
}

function 모든색(view: Awaited<ReturnType<typeof renderAtom>>): unknown[] {
  return [...findAllOfType(view.toJSON(), 'Text'), ...findAllOfType(view.toJSON(), 'View')].flatMap(
    (node) => {
      const style = flattenStyle(node.props.style)
      return [style.color, style.backgroundColor]
    },
  )
}

describe('증감은 어디에도 없다 ([[ADR-147]] 정정 4)', () => {
  // `rise`/`fall` 은 [[ADR-087]] 이 증감 전용으로 만든 토큰이라, 그 색이 이 타일에 나타나는 것은
  // 증감 표기가 되살아났다는 뜻이다. 퍼센트 기호도 같은 신호다.
  it.each(Object.entries(크기))('%s — 퍼센트도 `rise`/`fall` 색도 안 쓴다', async (_이름, 값) => {
    const view = await 위젯(값)

    expect(모든글자(view)).not.toContain('%')
    expect(모든색(view)).not.toContain(기본테마.riseInk)
    expect(모든색(view)).not.toContain(기본테마.fallInk)
    expect(모든색(view)).not.toContain(기본테마.riseTint)
    expect(모든색(view)).not.toContain(기본테마.fallTint)
  })

  it('직전 기간을 말하는 문구가 없다', async () => {
    const view = await 위젯(크기['4x3'])

    expect(모든글자(view)).not.toContain('지난 주')
    expect(모든글자(view)).not.toContain('대비')
  })
})

describe('기록이 없으면 0 을 그리고 그 사실을 함께 말한다 ([[ADR-147]] 정정 4)', () => {
  it.each(Object.entries(크기))('%s — `0 메소` + 미기록 한 줄', async (_이름, 값) => {
    const { getByText, getByTestId } = await 위젯(값, 빈_뷰모델)

    expect(getByText('0')).toBeTruthy()
    expect(getByText('메소')).toBeTruthy()
    expect(getByTestId('profit-note')).toBeTruthy()
  })

  // 0/0 인 바와 「결정석 0 · 아이템 0」은 분해할 것이 없는데 분해한 척이다.
  it('스택 바와 분해 금액이 그 자리에서 사라진다', async () => {
    const { queryByTestId } = await 위젯(크기['4x3'], 빈_뷰모델)

    expect(queryByTestId('profit-stack-bar')).toBeNull()
    expect(queryByTestId('profit-breakdown')).toBeNull()
  })

  it('기록이 있으면 그 줄이 없다', async () => {
    const { queryByTestId, getByTestId } = await 위젯(크기['4x3'])

    expect(queryByTestId('profit-note')).toBeNull()
    expect(getByTestId('profit-stack-bar')).toBeTruthy()
  })
})

describe('스택 바가 총액을 가른다', () => {
  it('두 조각의 폭이 결정석·아이템 비율이다', async () => {
    const { getByTestId } = await 위젯(크기['4x3'])

    // 픽스처 합계: 결정석 32억 · 아이템 8억 → 80% / 20%.
    // `0.8 * 100` 이 `80.00000000000001` 이라 끊지 않으면 그 꼴이 그대로 폭이 된다.
    expect(flattenStyle(getByTestId('profit-fill-crystal').props.style).width).toBe('80%')
    expect(flattenStyle(getByTestId('profit-fill-item').props.style).width).toBe('20%')
  })

  // 조각에 높이가 박혀 있으면 트랙만 키웠을 때 **아래쪽이 빈 채로** 남는다(실제로 그렇게 났다).
  // 조각은 자기 높이를 알면 안 되고 트랙을 그대로 채워야 한다.
  it.each(['4x3', '4x2', '2x2'] as const)('%s — 조각이 트랙 높이를 그대로 채운다', async (size) => {
    const { getByTestId } = await 위젯(크기[size])

    for (const key of ['crystal', 'item'] as const) {
      const style = flattenStyle(getByTestId(`profit-fill-${key}`).props.style)
      expect(style.height).toBe('100%')
    }
  })

  it('두 조각의 색이 [[ADR-142]] 링과 같은 짝이다 — 결정석 `primary` · 아이템 `third`', async () => {
    const { getByTestId } = await 위젯(크기['4x3'])

    expect(flattenStyle(getByTestId('profit-fill-crystal').props.style).backgroundColor).toBe(
      기본테마.primary,
    )
    expect(flattenStyle(getByTestId('profit-fill-item').props.style).backgroundColor).toBe(
      기본테마.third,
    )
  })

  it('분해 금액이 같은 두 값을 글자로 말한다', async () => {
    const { getByText } = await 위젯(크기['4x3'])

    expect(getByText('결정석')).toBeTruthy()
    expect(getByText('32.0억')).toBeTruthy()
    expect(getByText('아이템')).toBeTruthy()
    expect(getByText('8.0억')).toBeTruthy()
  })

  // 가격 미확정 보스만 처치한 주 — 기록은 있는데 금액이 0 이다. 나누면 NaN 폭이 된다.
  it('합이 0 이면 나누지 않고 빈 트랙을 남긴다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(
      크기['4x3'],
      뷰모델({
        profit: {
          totalMeso: 0,
          crystalMeso: 0,
          itemMeso: 0,
          hasRecords: true,
          periodRange: '8월 14일 ~ 8월 20일',
          topCharacters: [],
        },
      }),
    )

    expect(getByTestId('profit-stack-bar')).toBeTruthy()
    expect(queryByTestId('profit-fill-crystal')).toBeNull()
  })
})

describe('크기가 버리는 것 ([[ADR-147]] 정정 13)', () => {
  it('4x3 은 캐릭터 셋을 **내역과 함께** 그린다', async () => {
    const { getAllByTestId, getByText } = await 위젯(크기['4x3'])

    expect(getAllByTestId('profit-character-row')).toHaveLength(3)
    expect(getAllByTestId('profit-character-split')).toHaveLength(3)
    expect(getByText('결정석 20.0억 · 아이템 5.0억')).toBeTruthy()
  })

  it('4x2 는 목록을 남기고 **행 내역만** 버린다', async () => {
    const { getAllByTestId, queryByTestId } = await 위젯(크기['4x2'])

    expect(getAllByTestId('profit-character-row')).toHaveLength(3)
    expect(queryByTestId('profit-character-split')).toBeNull()
  })

  it('2x2 는 목록째 버리고 금액 + 스택 바만 남는다', async () => {
    const { queryByTestId, getByTestId } = await 위젯(크기['2x2'])

    expect(queryByTestId('profit-characters')).toBeNull()
    expect(getByTestId('profit-stack-bar')).toBeTruthy()
  })

  it('2x1 은 바까지 버리고 금액만 남는다', async () => {
    const { queryByTestId, getByTestId } = await 위젯(크기['2x1'])

    expect(queryByTestId('profit-stack-bar')).toBeNull()
    expect(queryByTestId('profit-characters')).toBeNull()
    expect(getByTestId('profit-amount')).toBeTruthy()
  })
})

describe('단위는 큰 금액에만 붙는다 ([[ADR-147]] 정정 4)', () => {
  it('머리는 `40.0억 메소` 이고 목록 행은 금액만이다', async () => {
    const { getByText, getAllByText } = await 위젯(크기['4x3'])

    expect(getByText('40.0억')).toBeTruthy()
    expect(getAllByText('메소')).toHaveLength(1)
    // 「가」의 총액 — 같은 줄에 「메소」가 따라붙지 않는다.
    expect(getByText('25.0억')).toBeTruthy()
  })

  it('금액에 `tabular-nums` 가 걸린다 — 자릿수가 바뀌어도 폭이 안 흔들린다', async () => {
    const { getByText } = await 위젯(크기['4x3'])

    expect(flattenStyle(getByText('40.0억').props.style).fontVariant).toEqual(['tabular-nums'])
  })
})

