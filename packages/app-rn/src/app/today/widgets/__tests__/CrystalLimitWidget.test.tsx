// 주간 결정석 판매 한도 위젯([[ADR-054]] · [[ADR-146]] 결정 6 · 정정 13·15). 이 파일이 지키는 것 넷 —
// ① **분모가 참조 데이터에서 온다**(리터럴이 아니다 — 값을 바꾸면 화면이 따라 바뀐다)
// ② **월드별 한도를 합치지 않는다**(90은 계정이 아니라 월드마다 각각이다, [[ADR-054]] 결정 1)
// ③ **넘치는 월드는 크기마다 다르게 접힌다**(4x1 은 셋까지 · 2x2 는 «외 N개 월드»)
// ④ **집계할 것이 없어도 타일은 자기 자리에서 말한다**([[ADR-146]] 결정 5 — 위젯은 사라지지 않는다)
//
// **네 크기를 전부 스냅샷으로 찍는다** — v1 배치가 쓰는 것은 2x1 하나뿐이라(정정 13) 나머지 셋은
// 아무도 안 부르는 렌더 분기이고, 그 분기의 유일한 안전망이 스냅샷이다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '@core/lib/boss-matching'

import { renderAtom } from '../../../../components/__tests__/render-atom'
import { CrystalLimitWidget } from '../CrystalLimitWidget'
import { 뷰모델, 빈_뷰모델, 월드한도, 월드한도목록 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'
import type { WidgetHeight } from '../../../../lib/widget-layout'

const 크기 = {
  '2x1': { w: 2, h: 1 },
  '4x1': { w: 4, h: 1 },
  '2x2': { w: 2, h: 2 },
  '1x1': { w: 1, h: 1 },
} as const

const 한월드 = 뷰모델({ crystalLimits: [월드한도()] })

async function 위젯(
  값: { w: number; h: WidgetHeight },
  data: TodayViewModel = 한월드,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<CrystalLimitWidget w={값.w} h={값.h} data={data} />)
}

describe('분모는 참조 데이터에서 온다 ([[ADR-006]] · [[ADR-054]] 결정 2)', () => {
  it.each(Object.entries(크기))('%s — 링이 `n/한도` 를 그린다', async (_이름, 값) => {
    const { getByText } = await 위젯(값)

    expect(getByText('34')).toBeTruthy()
    expect(getByText(`/${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeTruthy()
  })

  // 판별력 — 분모를 박아 뒀다면 이 케이스가 여전히 실제 한도를 그린다.
  it('한도가 달라지면 분모도 따라 달라진다', async () => {
    const { getByText, queryByText } = await 위젯(
      크기['2x1'],
      뷰모델({ crystalLimits: [월드한도({ limit: 7, cleared: 3 })] }),
    )

    expect(getByText('/7')).toBeTruthy()
    expect(queryByText(`/${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeNull()
  })

  // 위 두 케이스가 이미 값을 좇지만, 「우연히 같은 숫자」를 손으로 적는 회귀를 원천에서 막는다.
  it('소스에 한도 숫자가 없다', () => {
    const source = readFileSync(join(__dirname, '..', 'CrystalLimitWidget.tsx'), 'utf8')

    expect(source).not.toMatch(new RegExp(`(?<![\\w.])${WEEKLY_CRYSTAL_SALE_LIMIT}(?![\\w.])`))
  })
})

describe('남은 개수 ([[ADR-054]] 결정 1 — 이월되지 않는다)', () => {
  it('한도에서 소진량을 뺀 값이다', async () => {
    const { getByTestId } = await 위젯(크기['2x1'])

    expect(getByTestId('crystal-remaining')).toHaveTextContent(
      `${WEEKLY_CRYSTAL_SALE_LIMIT - 34}개 남음`,
    )
  })

  // 추적 밖 캐릭터가 있으면 소진량이 한도를 넘겨 보일 수 있다([[ADR-054]] 알려진 한계 1).
  it('한도를 넘겨도 «−n개 남음» 이라고 하지 않는다', async () => {
    const { getByTestId } = await 위젯(
      크기['2x1'],
      뷰모델({ crystalLimits: [월드한도({ cleared: WEEKLY_CRYSTAL_SALE_LIMIT + 5 })] }),
    )

    expect(getByTestId('crystal-remaining')).toHaveTextContent('0개 남음')
  })
})

describe('월드별 한도를 합치지 않는다 ([[ADR-054]] 결정 1)', () => {
  it('4x1 은 월드를 나란히 세우고 각자의 분모를 그대로 둔다', async () => {
    const { getAllByTestId, getByText, queryByText } = await 위젯(
      크기['4x1'],
      뷰모델({ crystalLimits: 월드한도목록(2) }),
    )

    expect(getAllByTestId('crystal-world-cell')).toHaveLength(2)
    expect(getByText('스카니아')).toBeTruthy()
    expect(getByText('루나')).toBeTruthy()
    // 보스 수익 화면은 좁은 한 줄이라 `n / 180` 으로 합치지만([[ADR-054]] 정정 2) 여기서는 안 합친다.
    expect(getAllByTestId('crystal-ring-denominator')).toHaveLength(2)
    expect(queryByText(`/${WEEKLY_CRYSTAL_SALE_LIMIT * 2}`)).toBeNull()
  })

  it('월드마다 소진량이 따로 센다', async () => {
    const { getByText } = await 위젯(크기['4x1'], 뷰모델({ crystalLimits: 월드한도목록(2) }))

    expect(getByText('10')).toBeTruthy()
    expect(getByText('20')).toBeTruthy()
  })
})

describe('넘치는 월드 ([[ADR-146]] — 타일 안에서 스크롤하지 않는다)', () => {
  it('4x1 은 셋까지 세운다', async () => {
    const { getAllByTestId, queryByText } = await 위젯(
      크기['4x1'],
      뷰모델({ crystalLimits: 월드한도목록(5) }),
    )

    expect(getAllByTestId('crystal-world-cell')).toHaveLength(3)
    expect(queryByText('베라')).toBeNull()
  })

  it('2x2 는 나머지를 «외 N개 월드» 한 줄로 접는다', async () => {
    const { getByText } = await 위젯(크기['2x2'], 뷰모델({ crystalLimits: 월드한도목록(4) }))

    expect(getByText('스카니아')).toBeTruthy()
    expect(getByText('외 3개 월드')).toBeTruthy()
  })

  it('나머지가 하나뿐이면 그 월드를 이름으로 말한다', async () => {
    const { getByText } = await 위젯(크기['2x2'], 뷰모델({ crystalLimits: 월드한도목록(2) }))

    expect(getByText(`루나 ${WEEKLY_CRYSTAL_SALE_LIMIT - 20}개 남음`)).toBeTruthy()
  })

  it('월드가 하나면 나머지 줄이 아예 없다', async () => {
    const { queryByTestId } = await 위젯(크기['2x2'])

    expect(queryByTestId('crystal-rest')).toBeNull()
  })

  // 이 크기의 정직함이 월드 하나까지라는 사실을 계약으로 남긴다(파일 머리 · 위젯 주석).
  it('1x1 은 링만 그린다 — 월드 이름이 사라진다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(크기['1x1'], 뷰모델({ crystalLimits: 월드한도목록(2) }))

    expect(getByTestId('crystal-ring')).toBeTruthy()
    expect(queryByTestId('crystal-world')).toBeNull()
    expect(queryByTestId('crystal-remaining')).toBeNull()
  })
})

describe('링', () => {
  it('접근성 이름이 월드와 진행을 함께 말한다', async () => {
    const { getByTestId } = await 위젯(크기['1x1'])

    expect(getByTestId('crystal-ring').props['aria-label']).toBe(
      `스카니아 주간 결정석 판매 34 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`,
    )
  })

  // 길이 0인 호를 `round` 캡으로 그리면 점 하나가 찍혀 «조금 팔았다» 로 보인다.
  it('소진이 0이면 찬 호를 그리지 않는다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(
      크기['2x1'],
      뷰모델({ crystalLimits: [월드한도({ cleared: 0 })] }),
    )

    expect(getByTestId('crystal-ring-track')).toBeTruthy()
    expect(queryByTestId('crystal-ring-fill')).toBeNull()
  })

  it('분자와 분모가 글자보다 낮은 줄 높이로 붙는다 ([[ADR-146]] 정정 15)', async () => {
    const { getByTestId } = await 위젯(크기['2x1'])

    for (const testID of ['crystal-ring-numerator', 'crystal-ring-denominator']) {
      const { fontSize, lineHeight } = getByTestId(testID).props.style
      expect(lineHeight).toBeLessThan(fontSize)
    }
  })
})

describe('집계할 것이 없을 때 ([[ADR-146]] 결정 5)', () => {
  it.each(Object.entries(크기))('%s — 자기 타일 안에서 그 사실만 말한다', async (_이름, 값) => {
    const { getByTestId, queryByTestId } = await 위젯(값, 빈_뷰모델)

    // 위젯은 사라지지 않는다 — 좌표 배치라 자리를 비우면 빈 사각형이 남는다.
    expect(getByTestId('widget-crystal-limit')).toBeTruthy()
    expect(getByTestId('crystal-empty')).toBeTruthy()
    expect(queryByTestId('crystal-ring')).toBeNull()
  })

  // 이유가 둘이라(기록 없음 / 월드 모름) 어느 쪽도 단정하지 않는다.
  it('«판매 0개» 라고 단정하지 않는다', async () => {
    const { getByText } = await 위젯(크기['2x1'], 빈_뷰모델)

    expect(getByText('집계할 기록이 없습니다')).toBeTruthy()
  })
})

describe('스냅샷 — 네 크기', () => {
  it.each(Object.entries(크기))('%s', async (_이름, 값) => {
    const view = await 위젯(값, 뷰모델({ crystalLimits: 월드한도목록(2) }))

    expect(view.toJSON()).toMatchSnapshot()
  })
})
