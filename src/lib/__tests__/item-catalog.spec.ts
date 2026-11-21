import fixture from '../../__fixtures__/game-data/items.json'
import { parseItems } from '../item-catalog'

describe('parseItems', () => {
  // 없는 줄을 가리키는 아이템은 묶음 · 반지 레벨을 찾지 못해 고르기 목록에서 조용히 빠진다. 표 전체를 버리면 들고 있던 표가 선다.
  it('이 칸 안에 없는 묶음 · 아이템 줄을 가리키면 표 전체를 버린다', () => {
    const [first, second] = fixture.items
    expect(parseItems(fixture)).not.toBeNull()
    expect(parseItems({ ...fixture, items: [{ ...first, groupId: 'nope' }, second] })).toBeNull()
    expect(
      parseItems({ ...fixture, ringLevelItems: [{ itemId: first.id, ringItemId: 'nope', ringLevel: 4 }] }),
    ).toBeNull()
    expect(parseItems({ ...fixture, sameItemLinks: [{ itemId: 'nope', originalItemId: first.id }] })).toBeNull()
  })

  // 레벨 0 짜리 장비가 생기면 스타포스 비용이 조용히 틀린다. 모르는 레벨은 빠진 칸이다.
  it('착용 레벨은 양의 정수이거나 null 이고, null 은 빠진 칸이 된다', () => {
    const only = (requiredLevel: number | null) => ({
      ...fixture,
      items: [{ ...fixture.items[0], requiredLevel }],
      ringLevelItems: [],
      sameItemLinks: [],
    })
    expect(parseItems(only(0))).toBeNull()
    expect(parseItems(only(250))?.items[0]?.requiredLevel).toBe(250)
    expect(parseItems(only(null))?.items[0]).not.toHaveProperty('requiredLevel')
  })
})
