// 활성 탭을 두 번 두드렸는가. 판정이 순수 함수인 것은 시간을 재는 코드를 컴포넌트에 두면
// 그것을 물으려면 렌더와 가짜 타이머가 함께 필요해지기 때문이다.
import { DOUBLE_TAP_MS, isSecondTap } from '../double-tap'

describe('isSecondTap', () => {
  it('앞선 누름이 없으면 첫 누름이다', () => {
    expect(isSecondTap(null, 'Today', 1_000)).toBe(false)
  })

  it('같은 항목을 창 안에서 다시 누르면 둘째 누름이다', () => {
    expect(isSecondTap({ key: 'Today', at: 1_000 }, 'Today', 1_200)).toBe(true)
  })

  // 경계를 양쪽에서 못박는다. 한쪽만 두면 부등호를 뒤집어도 초록이다.
  it('창의 끝은 포함하고 그 너머는 새 첫 누름이다', () => {
    const previous = { key: 'Today', at: 1_000 }

    expect(isSecondTap(previous, 'Today', 1_000 + DOUBLE_TAP_MS)).toBe(true)
    expect(isSecondTap(previous, 'Today', 1_000 + DOUBLE_TAP_MS + 1)).toBe(false)
  })

  it('다른 항목이면 창 안이어도 첫 누름이다', () => {
    expect(isSecondTap({ key: 'Today', at: 1_000 }, 'Utility', 1_100)).toBe(false)
  })

  // 시스템 더블탭 창과 같은 값이다. 늘리면 한참 뒤의 별개 누름 둘이 한 쌍으로 묶인다.
  it('창은 300ms 다', () => {
    expect(DOUBLE_TAP_MS).toBe(300)
  })
})
