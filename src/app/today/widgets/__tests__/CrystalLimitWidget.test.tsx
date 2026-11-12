// 주간 결정석 판매 한도 위젯. 이 파일이 지키는 것 넷.
// ① **분모가 참조 데이터에서 온다**(리터럴이 아니다. 값을 바꾸면 화면이 따라 바뀐다)
// ② **한도 줄을 합치지 않는다**(한도는 한도 줄마다 각각이다)
// ③ **넘치는 한도 줄은 첫 줄 이름 옆의 외 N 으로 접힌다**(타일 안에서 스크롤하지 않는다)
// ④ **집계할 것이 없어도 타일은 자기 자리에서 말한다**(위젯은 사라지지 않는다)

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { within } from '@testing-library/react-native'

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../../lib/boss/boss-matching'

import { renderAtom } from '../../../../components/__tests__/render-atom'
import { CrystalLimitWidget } from '../CrystalLimitWidget'
import { 뷰모델, 빈_뷰모델, 메이플ID한도, 한도줄, 한도줄목록 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'
import { flattenStyle } from '../../../../components/__tests__/render-atom'

const 한줄 = 뷰모델({ crystalLimits: [메이플ID한도([한도줄()])] })

async function 위젯(data: TodayViewModel = 한줄): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<CrystalLimitWidget data={data} />)
}

describe('분모는 참조 데이터에서 온다', () => {
  it('링이 `n/한도` 를 그린다', async () => {
    const { getByText } = await 위젯()

    expect(getByText('34')).toBeTruthy()
    expect(getByText(`/${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeTruthy()
  })

  // 판별력. 분모를 박아 뒀다면 이 케이스가 여전히 실제 한도를 그린다.
  it('한도가 달라지면 분모도 따라 달라진다', async () => {
    const { getByText, queryByText } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도([한도줄({ limit: 7, cleared: 3 })])] }),
    )

    expect(getByText('/7')).toBeTruthy()
    expect(queryByText(`/${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeNull()
  })

  // 위 두 케이스가 이미 값을 좇지만, `우연히 같은 숫자`를 손으로 적는 회귀를 원천에서 막는다.
  it('소스에 한도 숫자가 없다', () => {
    const source = readFileSync(join(__dirname, '..', 'CrystalLimitWidget.tsx'), 'utf8')

    expect(source).not.toMatch(new RegExp(`(?<![\\w.])${WEEKLY_CRYSTAL_SALE_LIMIT}(?![\\w.])`))
  })
})

describe('남은 개수 (이월되지 않는다)', () => {
  it('한도에서 소진량을 뺀 값이다', async () => {
    const { getByTestId } = await 위젯()

    expect(getByTestId('crystal-remaining')).toHaveTextContent(
      `${WEEKLY_CRYSTAL_SALE_LIMIT - 34}개 남음`,
    )
  })

  // 추적 밖 캐릭터가 있으면 소진량이 한도를 넘겨 보일 수 있다(알려진 한계 1).
  it('한도를 넘겨도 **−n개 남음** 이라고 하지 않는다', async () => {
    const { getByTestId } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도([한도줄({ cleared: WEEKLY_CRYSTAL_SALE_LIMIT + 5 })])] }),
    )

    expect(getByTestId('crystal-remaining')).toHaveTextContent('0개 남음')
  })
})

// 줄 이름은 같은 메이플 ID 에 한도 줄이 둘 이상일 때만 적는다(사용자 선택 2026-11-12). 줄이 하나면 가를 것이 없다.
describe('줄 이름', () => {
  it('한도 줄이 하나면 줄 이름을 적지 않는다', async () => {
    const { queryByTestId, queryByText } = await 위젯()

    expect(queryByTestId('crystal-line')).toBeNull()
    expect(queryByText('일반 월드')).toBeNull()
  })

  it('한도 줄이 둘이면 첫 줄 이름을 적는다', async () => {
    const { getByTestId } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도(한도줄목록(2))] }))

    expect(getByTestId('crystal-line-name')).toHaveTextContent('일반 월드')
  })
})

describe('넘치는 한도 줄 (합치지 않고 첫 줄 이름 옆에 접는다)', () => {
  it('첫 줄의 링 하나만 그린다. 줄끼리 분모를 더하지 않는다', async () => {
    const { getAllByTestId, queryByText } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도(한도줄목록(2))] }))

    expect(getAllByTestId('crystal-ring')).toHaveLength(1)
    expect(queryByText(`/${WEEKLY_CRYSTAL_SALE_LIMIT * 2}`)).toBeNull()
  })

  it('나머지는 첫 줄 이름 옆에 **외 N** 으로 붙는다', async () => {
    const { getByTestId } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도(한도줄목록(4))] }))
    const line = within(getByTestId('crystal-line'))

    expect(line.getByText('일반 월드')).toBeTruthy()
    expect(line.getByText('외 3')).toBeTruthy()
  })

  it('나머지가 하나여도 **외 1** 이고 그 줄의 이름과 남은 개수는 적지 않는다', async () => {
    const { getByTestId, queryByText } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도(한도줄목록(2))] }))

    expect(getByTestId('crystal-rest')).toHaveTextContent('외 1')
    expect(queryByText(/챌린저스/)).toBeNull()
  })

  // 말줄임 대신 줄을 나눈다. 줄 이름과 한 글자 덩어리로 합치면 줄 끝이 잘려 `외 N` 이 사라진다.
  it('줄에 안 들어가면 **외 N** 이 다음 줄로 내려간다', async () => {
    const { getByTestId } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도(한도줄목록(2))] }))

    expect(flattenStyle(getByTestId('crystal-line').props.style).flexWrap).toBe('wrap')
  })
})

describe('링', () => {
  it('접근성 이름이 진행을 말하고, 줄 이름이 있으면 함께 말한다', async () => {
    const 한줄_링 = (await 위젯()).getByTestId('crystal-ring')
    const 두줄_링 = (await 위젯(뷰모델({ crystalLimits: [메이플ID한도(한도줄목록(2))] }))).getByTestId('crystal-ring')

    expect(한줄_링.props['aria-label']).toBe(`주간 결정석 판매 34 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
    expect(두줄_링.props['aria-label']).toBe(`일반 월드 주간 결정석 판매 10 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
  })

  // 길이 0인 호를 `round` 캡으로 그리면 점 하나가 찍혀 **조금 팔았다** 로 보인다.
  it('소진이 0이면 찬 호를 그리지 않는다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(뷰모델({ crystalLimits: [메이플ID한도([한도줄({ cleared: 0 })])] }),
    )

    expect(getByTestId('progress-ring-track')).toBeTruthy()
    expect(queryByTestId('progress-ring-fill')).toBeNull()
  })

  // 앱의 진행률 링은 모두 12시에서 반시계로 찬다. 같은 부품이 화면마다 반대로 돌면 같은 뜻으로 읽히지 않는다.
  it('링은 반시계로 찬다', async () => {
    const { getByTestId } = await 위젯()

    expect(flattenStyle(getByTestId('crystal-ring-svg').props.style).transform).toContainEqual({ scaleX: -1 })
  })

  it('분자와 분모가 글자보다 낮은 줄 높이로 붙는다', async () => {
    const { getByTestId } = await 위젯()

    for (const testID of ['crystal-ring-numerator', 'crystal-ring-denominator']) {
      const { fontSize, lineHeight } = getByTestId(testID).props.style
      expect(lineHeight).toBeLessThan(fontSize)
    }
  })
})

describe('집계할 것이 없을 때', () => {
  it('자기 타일 안에서 그 사실만 말한다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(빈_뷰모델)

    // 위젯은 사라지지 않는다. 좌표 배치라 자리를 비우면 빈 사각형이 남는다.
    expect(getByTestId('widget-crystal-limit')).toBeTruthy()
    expect(getByTestId('crystal-empty')).toBeTruthy()
    expect(queryByTestId('crystal-ring')).toBeNull()
  })

  // 처치가 없을 뿐이면 뷰모델이 `0 / 한도` 를 준다. 이 줄은 세울 한도 줄이 없을 때만 선다.
  it('세울 한도 줄이 없으면 한 줄로 알린다', async () => {
    const { getByText } = await 위젯(빈_뷰모델)

    expect(getByText('집계할 기록이 없습니다')).toBeTruthy()
  })
})

// 메이플 ID 가 둘 이상이면 격자가 이 위젯을 4칸으로 넓힌다. 칸은 메이플 ID 마다 하나이고, 한도 줄마다 링 하나다.
// 막대는 쓰지 않는다. 메이플 ID 하나의 한도 줄이 많아야 둘이다(사용자 지정 2026-11-12).
describe('메이플 ID 가 둘 이상', () => {
  const 메이플ID_셋 = 뷰모델({
    crystalLimits: [
      메이플ID한도([한도줄({ cleared: 45 })], '4f1c08ab-sub'),
      메이플ID한도(한도줄목록(2), 'da9b2f21-main'),
      메이플ID한도([한도줄({ cleared: 90 })], '0c5a7e6f-sub2'),
    ],
  })

  it('메이플 ID 마다 칸을 두고 칸 맨 위에 그 이름을 적는다', async () => {
    const { getByText } = await 위젯(메이플ID_셋)

    for (const name of ['메이플ID-da9b2f21', '메이플ID-4f1c08ab', '메이플ID-0c5a7e6f']) {
      expect(getByText(name)).toBeTruthy()
    }
  })

  it('한도 줄이 하나면 반 폭 칸, 둘 이상이면 넓은 칸이고 한도 줄마다 링이 선다', async () => {
    const { getByTestId, getAllByTestId, queryByTestId } = await 위젯(메이플ID_셋)

    expect(getByTestId('crystal-cell-half-4f1c08ab-sub')).toBeTruthy()
    expect(getByTestId('crystal-cell-wide-da9b2f21-main')).toBeTruthy()
    expect(getAllByTestId('crystal-ring')).toHaveLength(4)
    expect(queryByTestId('crystal-bar')).toBeNull()
  })

  // 반 폭 칸에 링 둘을 넣으면 위아래로 쌓여 칸이 높아지거나 링 옆 글자 자리가 좁아진다(시안 4칸 C).
  it('넓은 칸은 링을 옆으로 나란히 두고 링마다 줄 이름을 적는다', async () => {
    const { getByTestId } = await 위젯(메이플ID_셋)
    const 넓은칸 = getByTestId('crystal-cell-wide-da9b2f21-main')

    expect(flattenStyle(within(넓은칸).getByTestId('crystal-cell-rings').props.style).flexDirection).toBe('row')
    expect(within(넓은칸).getByText('일반 월드')).toBeTruthy()
    expect(within(넓은칸).getByText('챌린저스')).toBeTruthy()
  })

  it('반 폭 칸은 줄 이름 없이 `N개 남음` 만 둔다', async () => {
    const { getByTestId } = await 위젯(메이플ID_셋)
    const 반칸 = within(getByTestId('crystal-cell-half-4f1c08ab-sub'))

    expect(반칸.queryByText('일반 월드')).toBeNull()
    expect(반칸.getByText(/개 남음/)).toHaveTextContent(`${WEEKLY_CRYSTAL_SALE_LIMIT - 45}개 남음`)
  })
})
