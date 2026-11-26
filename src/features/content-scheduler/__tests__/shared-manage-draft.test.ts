import type { ManualTrackedItem } from '../../../storage/manual-tracked-content'
import {
  applySharedManageDraft,
  changedSharedManageDraft,
  isSharedContentTracked,
} from '../manage-draft'

const 에픽 = 'epic_dungeon_high_mountain'

describe('isSharedContentTracked', () => {
  it('그 메이플 ID 의 캐릭터 가운데 하나라도 추적하면 켜져 있다', () => {
    const lists: ManualTrackedItem[][] = [[], [{ contentKey: 에픽, kind: 'weekly' }]]

    expect(isSharedContentTracked(lists, 에픽)).toBe(true)
    expect(isSharedContentTracked(lists, 'monster_park')).toBe(false)
  })
})

describe('applySharedManageDraft', () => {
  it('켠 항목은 컨텐츠의 주기를 종류로 넣는다', () => {
    expect(applySharedManageDraft([], { monster_park: true, [에픽]: true })).toEqual([
      { contentKey: 'monster_park', kind: 'daily' },
      { contentKey: 에픽, kind: 'weekly' },
    ])
  })

  it('이미 있으면 두 번 넣지 않는다', () => {
    const items: ManualTrackedItem[] = [{ contentKey: 'monster_park', kind: 'daily' }]

    expect(applySharedManageDraft(items, { monster_park: true })).toEqual(items)
  })

  it('끈 항목은 빼고, 초안에 없는 항목과 보스 항목은 그대로 둔다', () => {
    const items: ManualTrackedItem[] = [
      { contentKey: 'monster_park', kind: 'daily' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { kind: 'boss', bossKey: 'zakum', difficulty: 'normal' },
    ]

    expect(applySharedManageDraft(items, { monster_park: false })).toEqual(items.slice(1))
  })
})

describe('changedSharedManageDraft', () => {
  it('하나라도 기준과 같은 값은 바꾼 것이 아니다', () => {
    const lists: ManualTrackedItem[][] = [[{ contentKey: 에픽, kind: 'weekly' }], []]

    expect(changedSharedManageDraft({ [에픽]: true, monster_park: false }, lists)).toEqual({})
    expect(changedSharedManageDraft({ [에픽]: false, monster_park: true }, lists)).toEqual({
      [에픽]: false,
      monster_park: true,
    })
  })
})
