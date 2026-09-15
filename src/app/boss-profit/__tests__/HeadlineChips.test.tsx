// 총 수익 헤드라인 옆 칩 둘.
//
// `DeltaChip` 은 화면에서 떼어냈지만(총 수익에서는 뜻이 퇴색한다) 컴포넌트와 계약은 그대로 둔다.
// 되살릴 때 계약이 서 있어야 하므로 다섯을 그대로 적는다.
import { act, fireEvent, within } from '@testing-library/react-native'

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../lib/boss/boss-matching'
import type { BossProfitRow } from '../../../features/boss-profit/store'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { CrystalSummaryChip, DeltaChip } from '../HeadlineChips'
import type { CharacterGroup } from '../character-groups'
import { 다른주간보스, 보스행, 월간보스 } from './harness'

// 비교 대상 라벨("지난 주")은 now 기준 상대 표현이라 시각을 고정해 넘긴다.
// 2026-07-22 기준 이번 주는 2026-07-16, 그 직전 주가 2026-07-09 다.
const NOW = new Date('2026-07-22T12:00:00+09:00')

function renderDelta(totalMeso: number, previousMeso: number): ReturnType<typeof renderOverlay> {
  return renderOverlay(
    <DeltaChip
      totalMeso={totalMeso}
      previousMeso={previousMeso}
      tab="weekly"
      periodKey="2026-07-16"
      now={NOW}
    />,
  )
}

describe('DeltaChip', () => {
  it('늘었으면 퍼센트와 함께 증가를 말한다', async () => {
    const { getByLabelText, getByText } = await renderDelta(5_000_000, 4_000_000)

    expect(getByLabelText('지난 주 대비 25.0퍼센트 증가')).toBeTruthy()
    expect(getByText('25.0%')).toBeTruthy()
  })

  it('줄었으면 감소를 말한다', async () => {
    const { getByLabelText, getByText } = await renderDelta(3_000_000, 4_000_000)

    expect(getByLabelText('지난 주 대비 25.0퍼센트 감소')).toBeTruthy()
    expect(getByText('25.0%')).toBeTruthy()
  })

  it('같으면 사용자 지정 표기 "-" 다', async () => {
    const { getByLabelText, getByText } = await renderDelta(4_000_000, 4_000_000)

    expect(getByLabelText('지난 주 대비 변화 없음')).toBeTruthy()
    expect(getByText('-')).toBeTruthy()
  })

  // 조회한 적 없는 직전 기간도 0으로 들어온다. 퍼센트가 정의되지 않으므로 절대 증감이다.
  it('직전 기간이 0이면 퍼센트 대신 절대 증감을 보여준다', async () => {
    const { getByLabelText, getByText } = await renderDelta(500_000_000, 0)

    expect(getByLabelText(/지난 주에는 수익이 없었습니다/)).toBeTruthy()
    expect(getByText('5.0억')).toBeTruthy()
  })

  it('방향이 없으면 신호색을 쓰지 않는다. 빨강도 파랑도 거짓이다', async () => {
    const same = await renderDelta(4_000_000, 4_000_000)
    const up = await renderDelta(5_000_000, 4_000_000)

    const sameColor = same.getByLabelText('지난 주 대비 변화 없음').props.style.backgroundColor
    const upColor = up.getByLabelText('지난 주 대비 25.0퍼센트 증가').props.style.backgroundColor
    expect(sameColor).not.toBe(upColor)
  })
})

function group(rows: BossProfitRow[]): CharacterGroup {
  return {
    ocid: rows[0].ocid,
    characterName: rows[0].characterName,
    imageUrl: null,
    bossRows: rows,
    weeklySubtotals: [],
  }
}

describe('CrystalSummaryChip', () => {
  const 월간행 = (overrides: Partial<BossProfitRow> = {}): BossProfitRow =>
    보스행({ bossKey: 월간보스, cycle: 'monthly', periodKey: '2026-07', ...overrides })

  it('월드를 아는 캐릭터가 없으면 아예 그리지 않는다. 대비할 한도가 없다', async () => {
    // 프로바이더는 남으므로 트리 전체가 아니라 **칩이 없는 것**을 본다.
    const { queryByLabelText } = await renderOverlay(<CrystalSummaryChip groups={[group([보스행(), 월간행()])]} />)

    expect(queryByLabelText(/결정석/)).toBeNull()
  })

  it('단일 월드는 펼칠 것이 없어 버튼이 아니다', async () => {
    const { getByLabelText, queryByLabelText } = await renderOverlay(
      <CrystalSummaryChip groups={[group([보스행({ world: '스카니아' })])]} />,
    )

    expect(getByLabelText(`주간 결정석 판매 1 / ${WEEKLY_CRYSTAL_SALE_LIMIT}, 월간 결정석 0개`)).toBeTruthy()
    expect(queryByLabelText('월드별 결정석 판매 현황 닫기')).toBeNull()
  })

  // 한 칩에 두 몫을 싣는다. 월간 보스를 안 잡은 주에도 월간 몫은 `0개` 로 선다(사용자 지정).
  it('칩 하나가 주간 몫과 월간 몫을 함께 읽힌다', async () => {
    const { getByLabelText } = await renderOverlay(
      <CrystalSummaryChip groups={[group([보스행({ world: '스카니아' }), 월간행({ world: '스카니아' })])]} />,
    )

    // 월간 보스를 잡은 주에도 주간 몫의 분자는 그대로다. 월간 결정석은 90 한도 밖이다.
    expect(getByLabelText(`주간 결정석 판매 1 / ${WEEKLY_CRYSTAL_SALE_LIMIT}, 월간 결정석 1개`)).toBeTruthy()
  })

  // 각 월드가 각자 한도를 가지므로 분모가 월드 수만큼 는다.
  it('월드가 둘이면 분모가 두 배이고 눌러 분해를 펼칠 수 있다', async () => {
    const groups = [
      group([보스행({ world: '스카니아' })]),
      group([보스행({ ocid: 'ocid-2', bossKey: 다른주간보스, world: '루나' })]),
    ]
    const { getByLabelText, queryByTestId, getByTestId } = await renderOverlay(<CrystalSummaryChip groups={groups} />)

    const chip = getByLabelText(`주간 결정석 판매 2 / ${WEEKLY_CRYSTAL_SALE_LIMIT * 2}, 월간 결정석 0개`)
    expect(queryByTestId('world-crystal-breakdown')).toBeNull()

    await act(async () => {
      fireEvent.press(chip)
    })

    expect(getByTestId('world-crystal-breakdown')).toBeTruthy()
    // 바깥 탭으로 닫는 판이 함께 뜬다.
    expect(getByLabelText('월드별 결정석 판매 현황 닫기')).toBeTruthy()
  })

  // 칩에 두 몫이 있으니 펼친 상자도 월드마다 두 몫을 풀어 말한다(사용자 지정).
  it('펼치면 월드마다 한 줄에 주간과 월간을 함께 보인다. 월간 수도 행의 월드로 가른다', async () => {
    const groups = [
      group([보스행({ world: '스카니아' })]),
      group([
        보스행({ ocid: 'ocid-2', bossKey: 다른주간보스, world: '루나' }),
        월간행({ ocid: 'ocid-2', world: '루나' }),
      ]),
    ]
    const { getByLabelText, getByTestId } = await renderOverlay(<CrystalSummaryChip groups={groups} />)

    await act(async () => {
      fireEvent.press(getByLabelText(/주간 결정석 판매/))
    })

    const 상자 = within(getByTestId('world-crystal-breakdown'))
    expect(상자.getByText(`1 / ${WEEKLY_CRYSTAL_SALE_LIMIT} | 월간 0개`)).toBeTruthy()
    expect(상자.getByText(`1 / ${WEEKLY_CRYSTAL_SALE_LIMIT} | 월간 1개`)).toBeTruthy()
  })

  // 닫는 층과 내용이 **같은 창**에 있어야 한다. RN 의 `Modal` 은 앱 루트 뷰와 다른 네이티브 창이라
  // 항상 그 위이고 `zIndex` 로는 못 이긴다. 닫기 층만 창에 넣고 내용을 트리에 두면 투명한 닫기
  // 층이 상자 위에 깔려, 상자 안을 누르는 것이 전부 닫기로 먹힌다.
  //
  // 그래서 부모를 한 번 타고 올라가 **그 안에서** 닫기 층을 찾는다. 둘이 갈려 있으면 여기서 못 찾는다.
  it('팝오버 내용이 닫는 층과 같은 창에 있다', async () => {
    const groups = [
      group([보스행({ world: '스카니아' })]),
      group([보스행({ ocid: 'ocid-2', bossKey: 다른주간보스, world: '루나' })]),
    ]
    const { getByLabelText, getByTestId } = await renderOverlay(<CrystalSummaryChip groups={groups} />)

    await act(async () => {
      fireEvent.press(getByLabelText(/주간 결정석 판매/))
    })

    const 창 = getByTestId('world-crystal-breakdown').parent
    expect(창).not.toBeNull()
    expect(within(창!).getByLabelText('월드별 결정석 판매 현황 닫기')).toBeTruthy()
  })

  // 칩의 월간 수는 펼친 월드별 줄의 합이다(사용자 지정). 주간 몫과 같은 규칙이라 월드를 모르는 행은
  // 칩에도 안 든다. 그래서 칩 수가 카드 링의 합보다 작을 수 있다(사용자 감수).
  it('월드를 모르는 월간 보스 행은 칩의 월간 수에 안 든다', async () => {
    const groups = [
      group([보스행({ world: '스카니아' }), 월간행({ world: '스카니아' })]),
      group([보스행({ ocid: 'ocid-2', world: '스카니아' }), 월간행({ ocid: 'ocid-2', world: null })]),
    ]
    const { getByLabelText } = await renderOverlay(<CrystalSummaryChip groups={groups} />)

    expect(getByLabelText(`주간 결정석 판매 2 / ${WEEKLY_CRYSTAL_SALE_LIMIT}, 월간 결정석 1개`)).toBeTruthy()
  })

  it('칩의 월간 수는 펼친 월드별 줄의 합과 같다', async () => {
    const groups = [
      group([보스행({ world: '스카니아' }), 월간행({ world: '스카니아' })]),
      group([보스행({ ocid: 'ocid-2', bossKey: 다른주간보스, world: '루나' }), 월간행({ ocid: 'ocid-2', world: '루나' })]),
      group([월간행({ ocid: 'ocid-3', world: null })]),
    ]
    const { getByLabelText, getByTestId } = await renderOverlay(<CrystalSummaryChip groups={groups} />)

    await act(async () => {
      fireEvent.press(getByLabelText(`주간 결정석 판매 2 / ${WEEKLY_CRYSTAL_SALE_LIMIT * 2}, 월간 결정석 2개`))
    })

    const 상자 = within(getByTestId('world-crystal-breakdown'))
    expect(상자.getAllByText(`1 / ${WEEKLY_CRYSTAL_SALE_LIMIT} | 월간 1개`)).toHaveLength(2)
  })

  it('월드는 아는데 처치가 0이면 0 / 90 과 0개 를 그대로 보여준다', async () => {
    const { getByLabelText } = await renderOverlay(
      <CrystalSummaryChip groups={[group([보스행({ world: '스카니아', isComplete: false })])]} />,
    )

    expect(getByLabelText(`주간 결정석 판매 0 / ${WEEKLY_CRYSTAL_SALE_LIMIT}, 월간 결정석 0개`)).toBeTruthy()
  })
})
