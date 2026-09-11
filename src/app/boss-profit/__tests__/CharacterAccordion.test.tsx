// 웹 `BossProfitScreen.test.tsx`(3,232줄) 중 **카드에 관한 케이스들**의 명세를 읽어 다시 쓴 것이다.
// 화면 자체의 케이스는 `BossProfitScreen.test.tsx` 가 갖는다.
//
// 옮기지 않은 계약 넷
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
//    움직인다(닫을 이유가 사라졌다).
import { act, fireEvent } from '@testing-library/react-native'

import weeklyBossesData from '../../../data/weekly-bosses.json'
import { clearCountUpMemory } from '../../../hooks/useCountUp'
import valuableDropsData from '../../../data/valuable-drops.json'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss/boss-matching'
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

// 모션 줄이기는 분기로만 관측된다(`components/__tests__/reduced-motion.ts`).
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

describe('펼침 (#27)', () => {
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

  // 월간 보스 상세는 주간 탭의 그 캐릭터 목록 맨 위로 갔다(사용자 지정). 이 탭에는 주차별
  // 합계만 남는다. 행은 그룹에 실려 오지만(아바타 진행 링이 센다) 그리지 않는다.
  it('월간 탭은 주차별 합계만 그린다', async () => {
    const group = 그룹([보스행({ boss: 월간보스, cycle: 'monthly' })], [주차소계()])
    const { getByText, queryByTestId, getByRole } = await renderProfit(<CharacterAccordion group={group} />, 컨텍스트값({ tab: 'monthly' }))

    await act(async () => {
      fireEvent.press(getByRole('button', { expanded: false }))
    })

    expect(getByText('주차별 합계')).toBeTruthy()
    expect(queryByTestId('boss-profit-boss-row')).toBeNull()
  })
})

describe('처치 진행 링', () => {
  it('주간 탭은 한도(12)를 분모로 삼는다. 리터럴이 아니라 참조 데이터에서 온다', async () => {
    const group = 그룹([보스행(), 보스행({ boss: 다른주간보스 })])
    const { getByLabelText } = await renderProfit(<CharacterAccordion group={group} />)

    expect(getByLabelText(`주간 보스 처치 2 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)).toBeTruthy()
  })

  it('월간 탭은 월간 보스 종류 수를 분모로 삼는다. 주간 처치 수를 끌어오지 않는다', async () => {
    const group = 그룹([보스행({ boss: 월간보스, cycle: 'monthly' })])
    const { getByLabelText } = await renderProfit(<CharacterAccordion group={group} />, 컨텍스트값({ tab: 'monthly' }))

    expect(getByLabelText(`월간 보스 처치 1 / ${weeklyBossesData.monthly.length}`)).toBeTruthy()
  })
})

describe('고가 드롭 강조', () => {
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

  // 카드 겉면은 그 안에 무엇이 있는지에 대한 주장이다. 미완료 행은 금액 자리에 `미완료` 를
  // 세우므로, 같은 드롭이 카드를 두르면 펼쳐 봐도 없는 것을 겉면에서 주장하게 된다.
  it('미완료 행의 고가 드롭이면 링·글로우·배지가 하나도 안 붙는다', async () => {
    const { queryByTestId, queryByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹([보스행({ isComplete: false, payoutMeso: null })])} />,
      컨텍스트값({ dropsByRowKey: 고가드롭 }),
    )

    expect(queryByTestId('valuable-drop-card-ring')).toBeNull()
    expect(queryByTestId('valuable-drop-card-glow-low')).toBeNull()
    expect(queryByTestId('valuable-drop-card-glow-high')).toBeNull()
    expect(queryByLabelText('고가 드롭')).toBeNull()
  })

  it('링 색과 두께는 웹의 degrade 폴백 그대로다. 반경만 펼침에서 13으로 줄어든다', async () => {
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

  it('펼치면 맥동이 멈추고 정적 글로우만 남는다(결정 4). 링과 배지는 유지된다', async () => {
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

  it('모션을 끄면 접힘에서도 정적 글로우다. 펼침과 같은 그림에 도달한다', async () => {
    mockReducedMotion(true)
    const { getByTestId, queryByTestId } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 고가드롭 }),
    )

    expect(getByTestId('valuable-drop-card-glow-static')).toBeTruthy()
    expect(queryByTestId('valuable-drop-card-glow-high')).toBeNull()
  })
})

describe('아이템 수익', () => {
  const 값매긴드롭 = {
    [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [
      드롭({ priceState: 'entered', priceMeso: 1_000_000_000, priceShare: 1 }),
    ],
  }

  it('값을 매긴 아이템이 있으면 금액이 버튼이 되고 잉크가 갈린다', async () => {
    const { getByLabelText, getByTestId, queryByText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 값매긴드롭 }),
    )

    expect(getByLabelText('지내우시 아이템 수익 확인')).toBeTruthy()
    expect(getByTestId('item-revenue-underline')).toBeTruthy()
    expect(queryByText(/^아이템 \+/)).toBeNull()
  })

  it('값을 안 매긴 드롭만 있으면 칩이 없다. 미입력은 0원이 아니다', async () => {
    const 미입력 = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [드롭()] }
    const { queryByLabelText } = await renderProfit(
      <CharacterAccordion group={그룹()} />,
      컨텍스트값({ dropsByRowKey: 미입력 }),
    )

    expect(queryByLabelText('지내우시 아이템 수익 확인')).toBeNull()
  })

  it('`priceMeso` 는 있는데 `priceState` 가 없으면 여전히 칩이 없다. 여기가 값이 새는 자리다', async () => {
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

  it('칩을 눌러도 아코디언이 펼쳐지지 않는다. 내역 상자만 뜬다', async () => {
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

describe('실패 표식', () => {
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

  it('카드를 펼치면 닫힌다. 펼침이 레이아웃을 바꿔 잰 위치가 낡은 값이 된다', async () => {
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

  it('조회 불가는 영구라 다른 문구를 준다. 추적 해제 경로를 알린다', async () => {
    const { getByTestId, getByText } = await renderProfit(
      <CharacterAccordion group={그룹()} issue="unavailable" />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('character-issue-badge'))
    })

    expect(getByText('조회할 수 없는 캐릭터입니다')).toBeTruthy()
  })
})

// 월드 이전으로 조회할 수 없게 된 캐릭터는 이번 주에 행이 0개다. 그래도 카드는 서야 하고
// (안 그러면 화면이 빠진 것과 0원인 것을 같게 말한다) 배지가 그 이유를 말한다.
describe('행이 없는 조회 불가 카드', () => {
  const 빈그룹 = { ocid: 'stranded', characterName: '지내우시', imageUrl: null, bossRows: [], weeklySubtotals: [] }

  it('행이 0개여도 이름을 그린다', async () => {
    const { getByText } = await renderProfit(
      <CharacterAccordion group={빈그룹} issue="unavailable" />,
    )

    expect(getByText('지내우시')).toBeTruthy()
  })

  // `0 메소` 는 **0원을 벌었다**는 단정이다. 조회를 못 한 캐릭터에 그 말을 쓰면 안 되고, 그
  // 자리가 비어 있을 수도 없어 배지가 대신 선다.
  it('금액 자리에 `조회 불가` 배지가 서고 금액은 안 그린다', async () => {
    const { getByTestId, queryByText } = await renderProfit(
      <CharacterAccordion group={빈그룹} issue="unavailable" />,
    )

    expect(getByTestId('character-issue-amount')).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  // 같은 말을 두 번 하지 않는다. 금액 자리 배지가 이미 조회 불가 를 글자로 말한다.
  it('금액 자리 배지가 서면 원형 배지는 안 그린다', async () => {
    const { queryByTestId } = await renderProfit(
      <CharacterAccordion group={빈그룹} issue="unavailable" />,
    )

    expect(queryByTestId('character-issue-badge')).toBeNull()
  })

  it('그 배지를 탭하면 조회할 수 없다는 설명이 열린다', async () => {
    const { getByTestId, getByText } = await renderProfit(
      <CharacterAccordion group={빈그룹} issue="unavailable" />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('character-issue-amount'))
    })

    expect(getByText('조회할 수 없는 캐릭터입니다')).toBeTruthy()
  })

  // 금액이 0 이 아니면 그 돈은 기록에서 온 **아는 사실**이다. 조회 불가여도 배지로 덮지 않는다.
  it('번 돈이 있는 조회 불가 캐릭터는 금액을 그대로 그린다', async () => {
    const 번카드 = 그룹([보스행({ isComplete: true, payoutMeso: 1_000 })])
    const { getByTestId, queryByTestId } = await renderProfit(
      <CharacterAccordion group={번카드} issue="unavailable" />,
    )

    expect(queryByTestId('character-issue-amount')).toBeNull()
    expect(getByTestId('character-issue-badge')).toBeTruthy()
  })

  // 조회는 못 하는데 낡은 스케줄 캐시가 행을 만든 자리다. 행이 있어도 금액이 0 이면 그 0 을
  // 말할 수 없다.
  it('행이 있어도 금액이 0 이면 배지가 선다', async () => {
    const 빈돈카드 = 그룹([보스행({ isComplete: false, payoutMeso: 0 })])
    const { getByTestId, queryByText } = await renderProfit(
      <CharacterAccordion group={빈돈카드} issue="unavailable" />,
    )

    expect(getByTestId('character-issue-amount')).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  // 네트워크 실패는 마지막으로 확인한 기록을 보여주는 상태라 금액 자리를 안 건드린다.
  it('행이 없어도 `failed` 면 원형 배지 그대로다', async () => {
    const { getByTestId, queryByTestId } = await renderProfit(
      <CharacterAccordion group={빈그룹} issue="failed" />,
    )

    expect(queryByTestId('character-issue-amount')).toBeNull()
    expect(getByTestId('character-issue-badge')).toBeTruthy()
  })
})

// 카드의 얼굴에도 표식이 붙는다. 금액 자리의 배지만으로는 목록을 훑는 눈에 안 들어온다.
describe('조회 불가 카드의 얼굴', () => {
  it('조회 불가면 얼굴에 표식이 붙는다', async () => {
    const { getByTestId } = await renderProfit(
      <CharacterAccordion group={그룹()} issue="unavailable" />,
    )

    expect(getByTestId('portrait-unavailable')).toBeTruthy()
  })

  it('동기화 실패에는 안 붙는다', async () => {
    const { queryByTestId } = await renderProfit(
      <CharacterAccordion group={그룹()} issue="failed" />,
    )

    expect(queryByTestId('portrait-unavailable')).toBeNull()
  })
})

// 월간 탭의 두 자리가 서로 다른 말을 한다. 머리는 **그 달에 확실히 번 돈**을 말하고, 주차 행은
// 그 주를 아는가를 말한다. 한 주라도 기록이 있으면 그 달의 합계는 아는 값이다.
describe('월간 탭의 조회 불가 카드', () => {
  const 월간컨텍스트 = 컨텍스트값({ tab: 'monthly' })

  it('그 달 수익이 0이면 머리의 금액 자리에 배지가 선다', async () => {
    const 빈달 = 그룹([], [주차소계({ state: 'confirmedEmpty', totalMeso: 0 })])
    const { getByTestId } = await renderProfit(
      <CharacterAccordion group={빈달} issue="unavailable" />,
      월간컨텍스트,
    )

    expect(getByTestId('character-issue-amount')).toBeTruthy()
  })

  // 한 주라도 기록이 있으면 그 돈은 이미 받아 둔 사실이다. 배지로 덮으면 번 돈을 숨긴다.
  it('한 주라도 수익이 있으면 머리는 금액을 그린다', async () => {
    const 번달 = 그룹([], [주차소계({ state: 'recorded', totalMeso: 1_000 })])
    const { queryByTestId } = await renderProfit(
      <CharacterAccordion group={번달} issue="unavailable" />,
      월간컨텍스트,
    )

    expect(queryByTestId('character-issue-amount')).toBeNull()
  })

  // 주차 줄이 주마다 조회 불가 를 적으므로(`subtotal-issue`) 머리의 원형 배지는 같은 말을 한 번
  // 더 하는 것이고, 그 자리가 금액 좌상단이라 숫자를 가린다(사용자 지정).
  it('금액을 그릴 때 머리의 원형 배지는 안 선다', async () => {
    const 번달 = 그룹([], [주차소계({ state: 'recorded', totalMeso: 1_000 })])
    const { getByText, queryByTestId } = await renderProfit(
      <CharacterAccordion group={번달} issue="unavailable" />,
      월간컨텍스트,
    )

    expect(queryByTestId('character-issue-badge')).toBeNull()
    expect(getByText(/메소/)).toBeTruthy()
  })

  // `failed` 는 한 주가 아니라 카드 전체의 사실이라 주차 줄이 대신 말해 주지 않는다.
  it('`failed` 는 월간에서도 원형 배지가 선다', async () => {
    const 번달 = 그룹([], [주차소계({ state: 'recorded', totalMeso: 1_000 })])
    const { getByTestId } = await renderProfit(
      <CharacterAccordion group={번달} issue="failed" />,
      월간컨텍스트,
    )

    expect(getByTestId('character-issue-badge')).toBeTruthy()
  })

  it('그때 모르는 주에는 주차 행에 배지가 선다', async () => {
    const 번달 = 그룹([], [
      주차소계({ periodKey: '2026-09-03', state: 'recorded', totalMeso: 1_000 }),
      주차소계({ periodKey: '2026-09-10', state: 'inProgress', totalMeso: 0 }),
    ])
    const { getByRole, getAllByTestId } = await renderProfit(
      <CharacterAccordion group={번달} issue="unavailable" />,
      월간컨텍스트,
    )

    await act(async () => {
      fireEvent.press(getByRole('button', { name: /지내우시/ }))
    })

    expect(getAllByTestId('subtotal-issue')).toHaveLength(1)
  })
})
