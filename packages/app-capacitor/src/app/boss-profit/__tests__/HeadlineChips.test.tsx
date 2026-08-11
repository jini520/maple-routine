// @vitest-environment jsdom
// 총 수익 헤드라인의 칩들. `DeltaChip` 은 2026-08-10 에 화면에서 **떼어냈지만**(총 수익에서는
// 뜻이 퇴색한다는 사용자 판단 — 통계 기능으로 옮긴다) 컴포넌트와 계약은 그대로 둔다.
// 원래 `BossProfitScreen.test.tsx` 의 화면 통합 테스트였던 케이스를 여기로 옮겨 남긴 것이다 —
// 되살릴 때 [[ADR-087]] 의 계약이 서 있어야 한다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DeltaChip } from '../HeadlineChips'

afterEach(cleanup)

// 비교 대상 라벨("지난 주")은 now 기준 상대 표현이라([[ADR-023]]) 시각을 고정해 넘긴다.
// 2026-07-22 기준 이번 주는 2026-07-16, 그 직전 주가 2026-07-09 다.
const NOW = new Date('2026-07-22T12:00:00+09:00')

function renderDelta(totalMeso: number, previousMeso: number): void {
  render(
    <DeltaChip
      totalMeso={totalMeso}
      previousMeso={previousMeso}
      tab="weekly"
      periodKey="2026-07-16"
      now={NOW}
    />,
  )
}

describe('DeltaChip (ADR-087)', () => {
  it('늘었으면 퍼센트와 함께 증가를 말한다', () => {
    renderDelta(5_000_000, 4_000_000)

    expect(screen.getByLabelText('지난 주 대비 25.0퍼센트 증가')).toHaveTextContent('25.0%')
  })

  it('줄었으면 감소를 말한다', () => {
    renderDelta(3_000_000, 4_000_000)

    expect(screen.getByLabelText('지난 주 대비 25.0퍼센트 감소')).toHaveTextContent('25.0%')
  })

  it('같으면 사용자 지정 표기 "-" 다', () => {
    renderDelta(4_000_000, 4_000_000)

    expect(screen.getByLabelText('지난 주 대비 변화 없음')).toHaveTextContent('-')
  })

  // 결정 3 — 조회한 적 없는 직전 기간도 0으로 들어온다. 퍼센트가 정의되지 않으므로 절대 증감이다.
  it('직전 기간이 0이면 퍼센트 대신 절대 증감을 보여준다', () => {
    renderDelta(500_000_000, 0)

    expect(screen.getByLabelText(/지난 주에는 수익이 없었습니다/)).toHaveTextContent('5.0억')
  })

  it('방향이 없으면 신호색을 쓰지 않는다 — 빨강도 파랑도 거짓이다', () => {
    renderDelta(4_000_000, 4_000_000)

    expect(screen.getByLabelText('지난 주 대비 변화 없음')).toHaveClass('bg-primary-tint')
  })
})
