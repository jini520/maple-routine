// 저장된 순서를 읽을 때 표에 맞추는 규칙. 칸이 사라지면 그 화면으로 갈 수 없고, 양 끝이 밀리면 시작 화면과 맨 왼쪽 칸이 어긋난다.
import { DEFAULT_BAR_ORDER } from '../../../navigation/bar-groups'
import { isSameBarOrder, parseBarOrder } from '../config'

const MOVED = {
  groups: ['today', 'ledger', 'utility', 'schedule', 'settings'],
  subs: { schedule: ['Boss', 'Appointments', 'Content'], ledger: ['Stats', 'Profit', 'Cashbook', 'Inventory'] },
}

describe('parseBarOrder', () => {
  it('제대로 된 순서는 그대로 읽는다', () => {
    expect(parseBarOrder(MOVED)).toEqual(MOVED)
  })

  it('표에 없는 칸과 중복을 버린다', () => {
    const order = parseBarOrder({
      ...MOVED,
      groups: ['today', 'ledger', 'ledger', 'guild', 'utility', 'schedule', 'settings'],
    })

    expect(order.groups).toEqual(MOVED.groups)
  })

  it('다른 그룹의 페이지를 버린다', () => {
    const order = parseBarOrder({ ...MOVED, subs: { ...MOVED.subs, schedule: ['Boss', 'Profit', 'Appointments', 'Content'] } })

    expect(order.subs.schedule).toEqual(MOVED.subs.schedule)
  })

  // 업데이트로 칸이 늘어도 옛 저장값 때문에 새 칸이 사라지면 안 된다.
  it('빠진 칸을 표의 순서대로 뒤에 더한다', () => {
    const order = parseBarOrder({ groups: ['today', 'utility', 'settings'], subs: { ledger: ['Stats'] } })

    expect(order.groups).toEqual(['today', 'utility', 'schedule', 'ledger', 'settings'])
    expect(order.subs.ledger).toEqual(['Stats', 'Profit', 'Cashbook', 'Inventory'])
    expect(order.subs.schedule).toEqual(DEFAULT_BAR_ORDER.subs.schedule)
  })

  // 인벤토리 탭이 생기기 전에 저장한 순서에도 인벤토리가 뒤에 붙어 하위 탭이 빠지지 않는다.
  it('인벤토리가 없던 저장값은 수입·지출의 맨 뒤에 인벤토리를 더한다', () => {
    const order = parseBarOrder({ ...MOVED, subs: { ...MOVED.subs, ledger: ['Cashbook', 'Stats', 'Profit'] } })

    expect(order.subs.ledger).toEqual(['Cashbook', 'Stats', 'Profit', 'Inventory'])
  })

  it('today 와 더보기가 밀려 있으면 양 끝으로 되돌린다', () => {
    const order = parseBarOrder({ ...MOVED, groups: ['settings', 'ledger', 'today', 'utility', 'schedule'] })

    expect(order.groups).toEqual(MOVED.groups)
  })

  it.each([null, undefined, '깨진 값', 7, [], {}])('값이 %p 이면 기본 순서다', (raw) => {
    expect(parseBarOrder(raw)).toEqual(DEFAULT_BAR_ORDER)
  })
})

describe('isSameBarOrder', () => {
  it('하위 행의 순서만 달라도 다른 순서다', () => {
    const moved = parseBarOrder({ subs: { ledger: ['Cashbook', 'Profit', 'Stats'] } })

    expect(isSameBarOrder(moved, DEFAULT_BAR_ORDER)).toBe(false)
    expect(isSameBarOrder(parseBarOrder(null), DEFAULT_BAR_ORDER)).toBe(true)
  })
})
