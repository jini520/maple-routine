// 「저장 순서가 곧 표시 순서다」의 **계산**만 본다 — 화면을 렌더하지 않고
// 볼 수 있어서 따로 있다. 이 함수를 보는 자리가 셋(컨텐츠 레일 · 보스 레일 · 보스 수익 그룹)이라,
// 렌더로만 검사하면 셋 중 하나만 어긋난 상태를 못 잡는다(`bottom-bar-metrics.test.ts` 와 같은 판단).

import { orderByTracked } from '../scheduler/tracked-order'

interface 항목 {
  ocid: string
  characterName: string
}

const 아 = { ocid: 'a', characterName: '아' }
const 바 = { ocid: 'b', characterName: '바' }
const 사 = { ocid: 'c', characterName: '사' }

describe('orderByTracked — 저장 배열 순서로 다시 세운다', () => {
  it('저장 순서를 그대로 따른다 (스토어가 레벨 순으로 줘도)', () => {
    // core 스토어는 레벨 내림차순으로 준다 — 그 순서가 아니라 저장 순서가 이긴다.
    const 스토어순서: 항목[] = [사, 아, 바]

    expect(orderByTracked(스토어순서, ['a', 'b', 'c'])).toEqual([아, 바, 사])
  })

  it('같은 객체를 그대로 옮긴다 — 값을 새로 만들지 않는다', () => {
    const [first] = orderByTracked([바, 아], ['a', 'b'])

    expect(first).toBe(아)
  })

  it('원본 배열을 건드리지 않는다', () => {
    const 스토어순서: 항목[] = [사, 아, 바]

    orderByTracked(스토어순서, ['a', 'b', 'c'])

    expect(스토어순서).toEqual([사, 아, 바])
  })

  // **가장 중요한 케이스다.** 저장 목록과 스토어 목록은 한순간 어긋날 수 있고(저장 직후 · 동기화
  // 중간 커밋), 그때 목록에 없는 캐릭터를 버리면 화면에서 캐릭터가 통째로 사라진다.
  it('저장 목록에 없는 항목은 버리지 않고 뒤에 원래 순서로 남긴다', () => {
    const 스토어순서: 항목[] = [사, 아, 바]

    expect(orderByTracked(스토어순서, ['b'])).toEqual([바, 사, 아])
  })

  it('저장 목록이 비면 입력 순서 그대로다', () => {
    const 스토어순서: 항목[] = [사, 아, 바]

    expect(orderByTracked(스토어순서, [])).toEqual([사, 아, 바])
  })

  it('저장 목록에만 있고 화면에 없는 ocid 는 자리를 만들지 않는다', () => {
    expect(orderByTracked([바, 아], ['a', 'zzz', 'b'])).toEqual([아, 바])
  })

  it('빈 입력은 빈 결과다', () => {
    expect(orderByTracked([], ['a', 'b'])).toEqual([])
  })

  // 같은 ocid 가 두 번 오는 일은 없어야 하지만, 왔을 때 **개수가 줄면** 화면에서 카드가 사라진다.
  it('같은 ocid 가 겹쳐 와도 개수가 줄지 않는다', () => {
    const 겹침: 항목[] = [아, { ocid: 'a', characterName: '아(둘째)' }, 바]

    expect(orderByTracked(겹침, ['b', 'a'])).toHaveLength(3)
  })
})
