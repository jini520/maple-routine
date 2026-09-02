// 웹 `BossProfitScreen.test.tsx`(3,232줄) 중 **카드에 관한 케이스들**의 명세를 읽어 다시 쓴 것이다.
// 화면 자체의 케이스는 `BossProfitScreen.test.tsx` 가 갖는다.
//
// ── 옮기지 않은 계약 넷 ──────────────────────────────────────────────────────────────
//
// 웹 테스트가 지키던 것 중 **RN 에 자리가 없는** 것들이다. 빠뜨린 것이 아니라 없어진 것이라 여기
// 적어 둔다(`BossProfitScreen.contract.md` 의 **못 옮긴 것** 과 짝이다).
//
// ① `sticky`·`overflow-clip`·`z-[5]` 같은 **클래스 문자열 회귀 가드**. 중첩 sticky 를 못 옮겨
//    그 클래스들이 존재하지 않는다. 대신 **접힘/펼침 셸이 갈린다** 를 구조로 본다.
// ② **배지 sticky 레일**(`h-0` + `top`). 레일이 sticky 와 함께 사라졌다. 남은 계약은
//    "배지가 셸 바깥·카드 우상단" 이고 그것은 본다.
// ③ **stuck 헤더 하단 페이드**. 지나가는 콘텐츠가 없어 덮을 대상이 없다.
// ④ **스크롤로 팝오버 닫기**. 이 팝오버는 `fixed` 가 아니라 카드 안 절대배치라 카드와 함께
//    움직인다(닫을 이유가 사라졌다). 웹의 *"window 스크롤로는 안 닫힌다"* 회귀 가드도 함께 간다.
import { act, fireEvent } from '@testing-library/react-native'

import weeklyBossesData from '../../../data/weekly-bosses.json'
import { clearCountUpMemory } from '../../../hooks/useCountUp'
import valuableDropsData from '../../../data/valuable-drops.json'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss/boss-matching'
import { formatMesoShort } from '../../../lib/boss/boss-profit-delta'
import { dropRowKey } from '../../../features/boss-profit/store'
import type { RecordedDrop } from '../../../types/drops'

import { CharacterAccordion } from '../CharacterAccordion'
import { buildCharacterGroups } from '../character-groups'
import {
  VALUABLE_CARD_GLOW_STATIC,
  VALUABLE_CARD_RING_COLOR,
  VALUABLE_CARD_RING_RADIUS,
} from '../valuable-card-glow'
import { 다른주간보스, 월간보스, PERIOD, renderProfit, 보스행, 주간보스, 주차소계, 컨텍스트값 } from './harness'

// 모션 줄이기는 분기로만 관측된다(`components/__tests__/reduced-motion.ts` 파일 머리).
jest.mock('react-native-reanimated', () =>
  // 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. `require` 로만 된다.
  require('../../../components/__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import { mockReducedMotion } from '../../../components/__tests__/reduced-motion'

const 고가아이템 = valuableDropsData.items[0]

function 드롭(overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { itemName: '기타', slot: null, ...overrides } as RecordedDrop
}

function 그룹(rows = [보스행()], subtotals: ReturnType<typeof 주차소계>[] = []) {
  return buildCharacterGroups(rows, subtotals)[0]
}

beforeEach(() => {
  clearCountUpMemory()
})

// `useCountUp` 은 직전에 그린 값을 **모듈 수준 Map** 에 기억한다. 케이스
// 사이에 비우지 않으면 다음 렌더가 옛 값에서 굴러간다(`AccordionBody` 테스트와 같은 자리).
beforeEach(() => {
  clearCountUpMemory()
})

afterEach(() => {
  mockReducedMotion(false)
})

describe('펼침 (#27 · ADR-023)', () => {
  it('기본은 접힘이라 보스 행이 안 보인다', async () => {
    const { queryByText } = await renderProfit(<CharacterAccordion group={그룹()} />)

    expect(queryByText(주간보스)).toBeNull()
  })

  it('헤더를 누르면 펼쳐지고 다시 누르면 접힌다', async () => {
    const { getByText, queryByText, getByRole } = await renderProfit(<CharacterAccordion group={그룹()} />)

    await act(async () => {
      fireEvent.press(getByRole('button', { expanded: false }))
    })
    expect(getByText(주간보스)).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByRole('button', { expanded: true }))
    })
    expect(queryByText(주간보스)).toBeNull()
  })

  it('월간 탭은 주차별 합계와 월간 보스 두 서브섹션을 그린다', async () => {
    const group = 그룹([보스행({ boss: 월간보스, cycle: 'monthly' })], [주차소계()])
    const { getByText, getByRole } = await renderProfit(<CharacterAccordion group={group} />, 컨텍스트값({ tab: 'monthly' }))

    await act(async () => {
      fireEvent.press(getByRole('button', { expanded: false }))
    })

    expect(getByText('주간 보스 수익 · 주차별 합계')).toBeTruthy()
    expect(getByText('월간 보스 수익')).toBeTruthy()
  })
})

describe('처치 진행 링 (ADR-054 · ADR-059)', () => {
  it('주간 탭은 한도(12)를 분모로 삼는다 — 리터럴이 아니라 참조 데이터에서 온다', async () => {
    const group = 그룹([보스행(), 보스행({ boss: 다른주간보스 })])
    const { getByLabelText } = await renderProfit(<CharacterAccordion group={group} />)

    expect(getByLabelText(`주간 보스 처치 2 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)).toBeTruthy()
  })

  it('월간 탭은 월간 보스 종류 수를 분모로 삼는다(ADR-059 결정 3·4) — 주간 처치 수를 끌어오지 않는다', async () => {
    const group = 그룹([보스행({ boss: 월간보스, cycle: 'monthly' })])
    const { getByLabelText } = await renderProfit(<CharacterAccordion group={group} />, 컨텍스트값({ tab: 'monthly' }))

    expect(getByLabelText(`월간 보스 처치 1 / ${weeklyBossesData.monthly.length}`)).toBeTruthy()
  })
})

describe('고가 드롭 강조 (ADR-045)', () => {
  const 고가드롭 = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [드롭({ itemName: 고가아이템 })] }
  const 평범한드롭 = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [드롭()] }

  it('고가 아이템을 먹으면 골드 링·글로우·배지가 함께 붙는다', async () => {
    const { getByTestId, getByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 고가드롭 }),
    )

    expect(getByTestId('valuable-drop-card-ring')).toBeTruthy()
    expect(getByTestId('valuable-drop-card-glow-low')).toBeTruthy()
    expect(getByTestId('valuable-drop-card-glow-high')).toBeTruthy()
    expect(getByLabelText('고가 드롭')).toBeTruthy()
  })

  it('고가가 아닌 드롭만 있으면 강조가 하나도 안 붙는다', async () => {
    const { queryByTestId, queryByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 평범한드롭 }),
    )

    expect(queryByTestId('valuable-drop-card-ring')).toBeNull()
    expect(queryByTestId('valuable-drop-card-glow-low')).toBeNull()
    expect(queryByLabelText('고가 드롭')).toBeNull()
  })

  it('링 색과 두께는 웹의 degrade 폴백 그대로다 — 반경만 펼침에서 13으로 줄어든다(ADR-049 결정 3)', async () => {
    const { getByTestId, getByRole } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 고가드롭 }),
    )

    expect(getByTestId('valuable-drop-card-ring')).toHaveStyle({
      borderColor: VALUABLE_CARD_RING_COLOR,
      borderRadius: VALUABLE_CARD_RING_RADIUS.collapsed,
    })

    await act(async () => {
      fireEvent.press(getByRole('button', { expanded: false }))
    })

    expect(getByTestId('valuable-drop-card-ring')).toHaveStyle({
      borderRadius: VALUABLE_CARD_RING_RADIUS.expanded,
    })
  })

  it('펼치면 맥동이 멈추고 정적 글로우만 남는다(결정 4) — 링과 배지는 유지된다', async () => {
    const { getByTestId, queryByTestId, getByRole, getByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 고가드롭 }),
    )

    await act(async () => {
      fireEvent.press(getByRole('button', { expanded: false }))
    })

    expect(queryByTestId('valuable-drop-card-glow-low')).toBeNull()
    expect(getByTestId('valuable-drop-card-glow-static')).toHaveStyle({
      boxShadow: [...VALUABLE_CARD_GLOW_STATIC],
    })
    expect(getByTestId('valuable-drop-card-ring')).toBeTruthy()
    expect(getByLabelText('고가 드롭')).toBeTruthy()
  })

  it('모션을 끄면 접힘에서도 정적 글로우다 — 펼침과 같은 그림에 도달한다', async () => {
    mockReducedMotion(true)
    const { getByTestId, queryByTestId } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 고가드롭 }),
    )

    expect(getByTestId('valuable-drop-card-glow-static')).toBeTruthy()
    expect(queryByTestId('valuable-drop-card-glow-high')).toBeNull()
  })
})

describe('아이템 수익 (ADR-124 결정 7)', () => {
  const 값매긴드롭 = {
    [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [
      드롭({ priceState: 'entered', priceMeso: 1_000_000_000, priceShare: 1 }),
    ],
  }

  it('값을 매긴 아이템이 있으면 칩이 붙고 금액 잉크가 갈린다', async () => {
    const { getByLabelText, getByText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 값매긴드롭 }),
    )

    expect(getByLabelText('지내우시 아이템 수익 확인')).toBeTruthy()
    expect(getByText(`아이템 +${formatMesoShort(1_000_000_000)}`)).toBeTruthy()
  })

  it('값을 안 매긴 드롭만 있으면 칩이 없다 — 미입력은 0원이 아니다', async () => {
    const 미입력 = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [드롭()] }
    const { queryByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 미입력 }),
    )

    expect(queryByLabelText('지내우시 아이템 수익 확인')).toBeNull()
  })

  it('`priceMeso` 는 있는데 `priceState` 가 없으면 여전히 칩이 없다 — 여기가 값이 새는 자리다', async () => {
    const 상태없음 = {
      [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [드롭({ priceMeso: 9_000_000_000 })],
    }
    const { queryByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 상태없음 }),
    )

    expect(queryByLabelText('지내우시 아이템 수익 확인')).toBeNull()
  })

  it('스킵한 아이템은 칩을 만들지 않는다', async () => {
    const 스킵 = {
      [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [
        드롭({ priceState: 'excluded', priceMeso: 5_000_000_000 }),
      ],
    }
    const { queryByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 스킵 }),
    )

    expect(queryByLabelText('지내우시 아이템 수익 확인')).toBeNull()
  })

  it('칩을 눌러도 아코디언이 펼쳐지지 않는다 — 내역 상자만 뜬다', async () => {
    const { getByLabelText, getByTestId, queryByText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 값매긴드롭 }),
    )

    await act(async () => {
      fireEvent.press(getByLabelText('지내우시 아이템 수익 확인'))
    })

    expect(getByTestId('item-revenue-popover')).toBeTruthy()
    expect(queryByText(주간보스)).toBeNull()
  })
})

describe('실패 표식 (ADR-068 결정 3)', () => {
  it('issue 가 없으면 배지를 붙이지 않는다', async () => {
    const { queryByTestId } = await renderProfit(<CharacterAccordion group={그룹()} />)

    expect(queryByTestId('character-issue-badge')).toBeNull()
  })

  it('배지를 탭하면 설명이 열리고 아코디언은 펼쳐지지 않는다', async () => {
    const { getByTestId, queryByText } = await renderProfit(
      <CharacterAccordion group={그룹()} issue="failed" />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('character-issue-badge'))
    })

    expect(getByTestId('character-issue-popover')).toBeTruthy()
    expect(queryByText(주간보스)).toBeNull()
  })

  it('다시 탭하면 닫힌다', async () => {
    const { getByTestId, queryByTestId } = await renderProfit(
      <CharacterAccordion group={그룹()} issue="failed" />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('character-issue-badge'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('character-issue-badge'))
    })

    expect(queryByTestId('character-issue-popover')).toBeNull()
  })

  it('카드를 펼치면 닫힌다 — 펼침이 레이아웃을 바꿔 잰 위치가 낡은 값이 된다', async () => {
    const { getByTestId, queryByTestId, getByRole } = await renderProfit(
      <CharacterAccordion group={그룹()} issue="failed" />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('character-issue-badge'))
    })
    await act(async () => {
      fireEvent.press(getByRole('button', { expanded: false }))
    })

    expect(queryByTestId('character-issue-popover')).toBeNull()
  })

  it('조회 불가는 영구라 다른 문구를 준다 — 추적 해제 경로를 알린다', async () => {
    const { getByTestId, getByText } = await renderProfit(
      <CharacterAccordion group={그룹()} issue="unavailable" />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('character-issue-badge'))
    })

    expect(getByText('조회할 수 없는 캐릭터입니다')).toBeTruthy()
  })
})
