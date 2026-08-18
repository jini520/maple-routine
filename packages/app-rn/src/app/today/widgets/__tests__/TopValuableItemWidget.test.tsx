// 최고가 아이템 위젯([[ADR-147]] 결정 9 · 정정 5·11·13). 이 파일이 지키는 것 넷 —
// ① **미입력 건수를 여기서 말하지 않는다**(옆 타일이 든다 — 건수를 두 곳에서 말하지 않는다)
// ② **0건 문구는 한 줄뿐**(«N건이 값을 기다립니다» 를 만들지 않는다)
// ③ **이름은 한 줄**(두 줄로 접으면 행 높이가 데이터에 따라 흔들린다)
// ④ **단위 「메소」는 1x1 만 예외**(정정 11)
//
// **네 크기를 전부 스냅샷으로 찍는다** — v1 배치가 쓰는 것은 2x1 하나뿐이라(정정 13) 나머지 셋은
// 아무도 안 부르는 렌더 분기이고, 그 분기의 유일한 안전망이 스냅샷이다.

import { renderAtom, findAllOfType } from '../../../../components/__tests__/render-atom'
import { TopValuableItemWidget } from '../TopValuableItemWidget'
import { 뷰모델, 드롭, 빈_뷰모델, 최고가 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'
import type { WidgetHeight } from '../../../../lib/widget-layout'

const 크기 = {
  '2x1': { w: 2, h: 1 },
  '4x2': { w: 4, h: 2 },
  '2x2': { w: 2, h: 2 },
  '1x1': { w: 1, h: 1 },
} as const

const 있음 = 뷰모델({ topItem: 최고가(4) })

async function 위젯(
  값: { w: number; h: WidgetHeight },
  data: TodayViewModel = 있음,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<TopValuableItemWidget w={값.w} h={값.h} data={data} />)
}

function 모든글자(view: Awaited<ReturnType<typeof renderAtom>>): string {
  return findAllOfType(view.toJSON(), 'Text')
    .flatMap((node) => (node.children ?? []).filter((child) => typeof child === 'string'))
    .join('|')
}

describe('금액은 네 크기에 다 서고 단위만 1x1 에서 빠진다 ([[ADR-147]] 정정 11)', () => {
  it.each(Object.entries(크기))('%s — 금액을 그린다', async (_이름, 값) => {
    const { getByText } = await 위젯(값)

    expect(getByText('120.0억')).toBeTruthy()
  })

  it.each([['2x1', 크기['2x1']], ['4x2', 크기['4x2']], ['2x2', 크기['2x2']]] as const)(
    '%s 에는 「메소」가 붙는다',
    async (_이름, 값) => {
      const { getByText } = await 위젯(값)

      expect(getByText('메소')).toBeTruthy()
    },
  )

  // 73×76 이라 물리적으로 안 들어간다 — 정정 11이 유일하게 뺀 자리다.
  it('1x1 에는 「메소」가 없다', async () => {
    const { queryByText } = await 위젯(크기['1x1'])

    expect(queryByText('메소')).toBeNull()
  })
})

describe('0건 ([[ADR-147]] 정정 5)', () => {
  it.each(Object.entries(크기))('%s — 한 줄로 그 사실만 말한다', async (_이름, 값) => {
    const { getByText, queryByTestId } = await 위젯(값, 빈_뷰모델)

    expect(getByText('가격이 입력된 아이템이 없습니다')).toBeTruthy()
    expect(queryByTestId('top-item-amount')).toBeNull()
  })

  // 건수는 위젯 7의 몫이다 — 옆 타일이 들고 있으면 이 타일이 또 들 이유가 없다.
  it('미입력 건수가 있어도 이 타일은 그것을 말하지 않는다', async () => {
    const view = await 위젯(크기['2x1'], 뷰모델({ topItem: null, unpricedCount: 7 }))

    expect(모든글자(view)).not.toContain('7')
    expect(모든글자(view)).not.toContain('미입력')
    expect(모든글자(view)).not.toContain('기다')
  })

  it('기록이 있을 때도 미입력 건수를 말하지 않는다', async () => {
    const view = await 위젯(크기['4x2'], 뷰모델({ topItem: 최고가(4), unpricedCount: 7 }))

    expect(모든글자(view)).not.toContain('미입력')
  })
})

describe('분배 표기 ([[ADR-147]] 정정 21)', () => {
  it('4x2 는 «N인 분배» 를 단다 — 총액보다 작은 이유를 그 자리에서 말한다', async () => {
    const { getByTestId } = await 위젯(크기['4x2'], 뷰모델({ topItem: 최고가(2, { shareCount: 3 }) }))

    expect(getByTestId('top-item-share')).toHaveTextContent('3인 분배')
  })

  it('단독이면 안 단다 — 나눈 적 없는데 «1인 분배» 는 없는 사건을 말하는 것이다', async () => {
    const { queryByTestId } = await 위젯(크기['4x2'], 뷰모델({ topItem: 최고가(2, { shareCount: 1 }) }))

    expect(queryByTestId('top-item-share')).toBeNull()
  })

  // 2x2 아래로는 158px 안에 아이콘 40 + 금액 78 이 이미 들어가 있어 이 줄을 넣을 폭이 없다.
  // 억지로 넣으면 말줄임에 먹혀 설명이 아니라 잡음이 된다 — 자리가 있는 크기에만 둔다.
  it.each(['2x2', '2x1', '1x1'] as const)('%s 은 자리가 없어 안 단다', async (size) => {
    const { queryByTestId } = await 위젯(크기[size], 뷰모델({ topItem: 최고가(0, { shareCount: 3 }) }))

    expect(queryByTestId('top-item-share')).toBeNull()
  })
})

describe('크기가 버리는 것 ([[ADR-147]] 정정 5·13)', () => {
  // 이름은 잘려야 들어간다 — 잘린 한 조각보다 «얼마였나» 가 이 타일이 답하는 질문이다.
  it('2x1 은 아이템 이름을 버린다', async () => {
    const { queryByTestId, getByText } = await 위젯(크기['2x1'])

    expect(queryByTestId('top-item-name')).toBeNull()
    expect(getByText('이번 주 최고가')).toBeTruthy()
  })

  it('2x2 는 이름과 캐릭터·보스를 남기되 2~5위는 버린다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(크기['2x2'])

    expect(getByTestId('top-item-name')).toBeTruthy()
    expect(getByTestId('top-item-origin')).toBeTruthy()
    expect(queryByTestId('top-item-rest')).toBeNull()
  })

  it('4x2 만 2~5위를 그린다', async () => {
    const { getAllByTestId, getByText } = await 위젯(크기['4x2'])

    expect(getAllByTestId('top-item-rest-row')).toHaveLength(4)
    expect(getByText('2위 아이템')).toBeTruthy()
    expect(getByText('5위 아이템')).toBeTruthy()
  })

  it('4x2 는 항목이 모자라면 있는 만큼만 그린다', async () => {
    const { getAllByTestId } = await 위젯(크기['4x2'], 뷰모델({ topItem: 최고가(2) }))

    expect(getAllByTestId('top-item-rest-row')).toHaveLength(2)
  })

  it('1위뿐이면 오른쪽 목록 자체가 없다', async () => {
    const { queryByTestId, getByTestId } = await 위젯(크기['4x2'], 뷰모델({ topItem: 최고가(0) }))

    expect(queryByTestId('top-item-rest')).toBeNull()
    expect(getByTestId('top-item-amount')).toBeTruthy()
  })
})

describe('아이템 이름과 출처', () => {
  it('이름은 한 줄이다 — 두 줄로 접으면 행 높이가 데이터에 흔들린다', async () => {
    const { getByTestId } = await 위젯(크기['2x2'])

    expect(getByTestId('top-item-name').props.numberOfLines).toBe(1)
  })

  it('반지는 레벨을 이름에 붙인다', async () => {
    const { getByText } = await 위젯(
      크기['2x2'],
      뷰모델({ topItem: { top: 드롭({ ringLevel: 4 }), rest: [] } }),
    )

    expect(getByText('가디언 엔젤 링 4레벨')).toBeTruthy()
  })

  it('캐릭터 · 보스 순으로 선다', async () => {
    const { getByText } = await 위젯(크기['2x2'])

    expect(getByText('야간비행 · 스우')).toBeTruthy()
  })

  // ocid 는 사용자에게 뜻이 없는 값이라 대신 넣지 않는다(대표 카드와 같은 규칙).
  it('캐릭터 이름을 모르면 보스만 선다', async () => {
    const { getByText } = await 위젯(
      크기['2x2'],
      뷰모델({ topItem: { top: 드롭({ characterName: undefined }), rest: [] } }),
    )

    expect(getByText('스우')).toBeTruthy()
  })
})

describe('아이콘', () => {
  it('매핑에 있는 이름이면 번들 에셋을 그린다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(크기['2x1'])

    expect(getByTestId('top-item-icon')).toBeTruthy()
    expect(queryByTestId('top-item-icon-fallback')).toBeNull()
  })

  // 다른 아이템 그림을 대신 세우면 «이 아이템» 으로 읽힌다 — 빈 상자가 폴백이다.
  it('매핑에 없는 이름이면 빈 상자가 선다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(
      크기['2x1'],
      뷰모델({ topItem: { top: 드롭({ itemName: '없는아이템' }), rest: [] } }),
    )

    expect(getByTestId('top-item-icon-fallback')).toBeTruthy()
    expect(queryByTestId('top-item-icon')).toBeNull()
  })
})

describe('스냅샷 — 네 크기', () => {
  it.each(Object.entries(크기))('%s', async (_이름, 값) => {
    const view = await 위젯(값)

    expect(view.toJSON()).toMatchSnapshot()
  })
})
