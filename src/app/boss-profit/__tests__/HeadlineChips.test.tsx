// 총 수익 헤드라인 옆 칩 둘.
//
// `DeltaChip` 은 2026-08-10 에 화면에서 **떼어냈지만**(총 수익에서는 뜻이 퇴색한다는 사용자 판단 —
// 통계 기능으로 옮긴다) 컴포넌트와 계약은 그대로 둔다. 되살릴 때 [[ADR-087]] 의 계약이 서 있어야
// 하므로 웹판 다섯을 그대로 옮겼다.
import { act, fireEvent } from '@testing-library/react-native'

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../lib/boss/boss-matching'
import type { BossProfitRow } from '../../../features/boss-profit/store'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { CrystalSummaryChip, DeltaChip } from '../HeadlineChips'
import type { CharacterGroup } from '../character-groups'
import { 다른주간보스, 보스행 } from './harness'

// 비교 대상 라벨("지난 주")은 now 기준 상대 표현이라([[ADR-023]]) 시각을 고정해 넘긴다.
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

describe('DeltaChip ([[ADR-087]])', () => {
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

  // 결정 3 — 조회한 적 없는 직전 기간도 0으로 들어온다. 퍼센트가 정의되지 않으므로 절대 증감이다.
  it('직전 기간이 0이면 퍼센트 대신 절대 증감을 보여준다', async () => {
    const { getByLabelText, getByText } = await renderDelta(500_000_000, 0)

    expect(getByLabelText(/지난 주에는 수익이 없었습니다/)).toBeTruthy()
    expect(getByText('5.0억')).toBeTruthy()
  })

  it('방향이 없으면 신호색을 쓰지 않는다 — 빨강도 파랑도 거짓이다', async () => {
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

describe('CrystalSummaryChip ([[ADR-054]])', () => {
  it('월드를 아는 캐릭터가 없으면 아예 그리지 않는다 — 대비할 한도가 없다', async () => {
    // 프로바이더는 남으므로 트리 전체가 아니라 **칩이 없는 것**을 본다.
    const { queryByLabelText } = await renderOverlay(
      <CrystalSummaryChip tab="weekly" groups={[group([보스행()])]} />,
    )

    expect(queryByLabelText(/주간 결정석 판매/)).toBeNull()
  })

  it('단일 월드는 펼칠 것이 없어 버튼이 아니다', async () => {
    const { getByLabelText, queryByLabelText } = await renderOverlay(
      <CrystalSummaryChip tab="weekly" groups={[group([보스행({ world: '스카니아' })])]} />,
    )

    expect(getByLabelText(`주간 결정석 판매 1 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeTruthy()
    expect(queryByLabelText('월드별 결정석 판매 현황 닫기')).toBeNull()
  })

  // 결정 7 — 각 월드가 각자 한도를 가지므로 분모가 월드 수만큼 는다.
  it('월드가 둘이면 분모가 두 배이고 눌러 분해를 펼칠 수 있다', async () => {
    const groups = [
      group([보스행({ world: '스카니아' })]),
      group([보스행({ ocid: 'ocid-2', boss: 다른주간보스, world: '루나' })]),
    ]
    const { getByLabelText, queryByTestId, getByTestId } = await renderOverlay(
      <CrystalSummaryChip tab="weekly" groups={groups} />,
    )

    const chip = getByLabelText(`주간 결정석 판매 2 / ${WEEKLY_CRYSTAL_SALE_LIMIT * 2}`)
    expect(queryByTestId('world-crystal-breakdown')).toBeNull()

    await act(async () => {
      fireEvent.press(chip)
    })

    expect(getByTestId('world-crystal-breakdown')).toBeTruthy()
    // 바깥 탭으로 닫는 판이 함께 뜬다(웹의 `fixed inset-0` 자리 — 파일 머리 ①).
    expect(getByLabelText('월드별 결정석 판매 현황 닫기')).toBeTruthy()
  })

  it('월드는 아는데 처치가 0이면 0 / 90 을 그대로 보여준다', async () => {
    const { getByLabelText } = await renderOverlay(
      <CrystalSummaryChip tab="weekly" groups={[group([보스행({ world: '스카니아', isComplete: false })])]} />,
    )

    expect(getByLabelText(`주간 결정석 판매 0 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeTruthy()
  })

  it('월간 탭은 월드 한도와 무관한 별개 수치라 "개" 로 센다', async () => {
    const { getByLabelText } = await renderOverlay(
      <CrystalSummaryChip
        tab="monthly"
        groups={[group([보스행({ cycle: 'monthly', world: '스카니아' })])]}
      />,
    )

    expect(getByLabelText('월간 결정석 1개')).toBeTruthy()
  })
})
