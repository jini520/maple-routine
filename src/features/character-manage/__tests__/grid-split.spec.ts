// 어느 칸이 선택된 것인가. 격자는 자리를 알려 줄 뿐 뜻을 모르고, 뜻을 붙이는 것이 이 함수다.
//
// 순서 변경·추가·해제 셋이 전부 여기를 지난다. 화면을 세워서는 못 묻는 계산이라 여기서 다 잰다.
import { SEPARATOR_KEY, selectedFromOrder } from '../grid-split'

describe('selectedFromOrder', () => {
  it('구분자 앞이 선택된 것이다', () => {
    expect(selectedFromOrder(['a', 'b', SEPARATOR_KEY, 'c', 'd'])).toEqual(['a', 'b'])
  })

  // 마지막 하나를 아래로 내린 경우. 선택된 것이 없는 상태는 정상이다(저장이 막힐 뿐이다).
  it('구분자가 맨 앞이면 빈 배열이다', () => {
    expect(selectedFromOrder([SEPARATOR_KEY, 'a', 'b'])).toEqual([])
  })

  it('구분자가 맨 뒤면 전부 선택된 것이다', () => {
    expect(selectedFromOrder(['a', 'b', SEPARATOR_KEY])).toEqual(['a', 'b'])
  })

  // 격자가 구분자를 빠뜨린 배열을 줄 수 있는 상황은 없어야 하지만, 그때 전부를 선택된 것으로
  // 읽으면 후보 전원이 한 번에 추적 목록에 들어간다. 그것보다 아무것도 안 바꾸는 편이 안전하다.
  it('구분자가 없으면 null 이다. 전부를 선택으로 읽지 않는다', () => {
    expect(selectedFromOrder(['a', 'b'])).toBeNull()
  })

  it('빈 배열도 null 이다', () => {
    expect(selectedFromOrder([])).toBeNull()
  })
})
