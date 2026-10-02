// 약속의 보스를 캐릭터별로 묶는다. 묶음은 캐릭터를 처음 고른 순서로 서고, 순서는 묶음 안에서만 바뀐다.
import type { PartyAppointmentBoss } from '../../../types/party-appointment'
import { groupBossesByCharacter, moveWithinGroup, orderByCharacter } from '../boss-groups'

const 림보 = { bossKey: 'limbo', difficulty: 'hard', ocid: 'a' }
const 발드 = { bossKey: 'bardrix', difficulty: 'hard', ocid: 'a' }
const 유피 = { bossKey: 'jupiter', difficulty: 'normal', ocid: 'b' }
const 카링 = { bossKey: 'kaling', difficulty: 'normal', ocid: 'a' }

const keys = (bosses: readonly PartyAppointmentBoss[]) => bosses.map((boss) => boss.bossKey)

describe('groupBossesByCharacter', () => {
  it('캐릭터를 처음 고른 순서로 묶는다', () => {
    const groups = groupBossesByCharacter([림보, 유피, 발드, 카링])

    expect(groups.map((group) => group.ocid)).toEqual(['a', 'b'])
    expect(keys(groups[0]!.bosses)).toEqual(['limbo', 'bardrix', 'kaling'])
    expect(keys(groups[1]!.bosses)).toEqual(['jupiter'])
  })

  it('보스가 없으면 묶음도 없다', () => {
    expect(groupBossesByCharacter([])).toEqual([])
  })
})

describe('orderByCharacter', () => {
  // 저장되는 한 줄은 묶음 순서대로 펼친 것이다. 화면과 알림이 같은 순서를 본다.
  it('묶음 순서대로 펼친다', () => {
    expect(keys(orderByCharacter([림보, 유피, 발드, 카링]))).toEqual(['limbo', 'bardrix', 'kaling', 'jupiter'])
  })
})

describe('moveWithinGroup', () => {
  it('그 캐릭터 묶음 안에서만 옮긴다', () => {
    const next = moveWithinGroup([림보, 발드, 카링, 유피], 'a', 0, 2)

    expect(keys(next)).toEqual(['bardrix', 'kaling', 'limbo', 'jupiter'])
  })

  it('다른 묶음은 그대로다', () => {
    const next = moveWithinGroup([림보, 발드, 유피], 'b', 0, 0)

    expect(keys(next)).toEqual(['limbo', 'bardrix', 'jupiter'])
  })
})
