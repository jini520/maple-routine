import { bossPickerSections, isPicked, togglePick } from '../boss-picker'
import { partySizeKey } from '../../boss-scheduler/store'

const OCID = 'ocid-1'
const NO_SHARE = { crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null }

describe('bossPickerSections', () => {
  const registered = [
    { bossKey: 'black_mage', difficulty: 'hard' },
    { bossKey: 'limbo', difficulty: 'hard' },
    { bossKey: 'bardrix', difficulty: 'normal' },
    { bossKey: 'jupiter', difficulty: 'normal' },
  ]

  it('파티 인원이 둘 이상이거나 분배 비율이 있는 등록 보스는 파티, 나머지 등록 보스는 스케줄러다', () => {
    const sections = bossPickerSections({
      ocid: OCID,
      registered,
      partySizes: { [partySizeKey(OCID, 'limbo', 'hard')]: 3, [partySizeKey(OCID, 'jupiter', 'normal')]: 1 },
      partyShares: {
        [partySizeKey(OCID, 'bardrix', 'normal')]: { ...NO_SHARE, crystalMyShare: 1, crystalSharesTotal: 4 },
      },
    })

    expect(sections.party).toEqual([
      { bossKey: 'limbo', difficulty: 'hard' },
      { bossKey: 'bardrix', difficulty: 'normal' },
    ])
    expect(sections.scheduler).toEqual([
      { bossKey: 'black_mage', difficulty: 'hard' },
      { bossKey: 'jupiter', difficulty: 'normal' },
    ])
  })

  it('모든 보스는 등록 보스면 등록 난이도, 아니면 가장 높은 난이도로 선다', () => {
    const sections = bossPickerSections({ ocid: OCID, registered, partySizes: {}, partyShares: {} })

    expect(sections.all).toContainEqual({ bossKey: 'limbo', difficulty: 'hard' })
    expect(sections.all).toContainEqual({ bossKey: 'bardrix', difficulty: 'normal' })
    // 카링은 이지 · 노멀 · 하드 · 익스트림이고 등록되지 않았다.
    expect(sections.all).toContainEqual({ bossKey: 'kaling', difficulty: 'extreme' })
  })

  it('모든 보스에 같은 보스가 두 번 서지 않는다', () => {
    const sections = bossPickerSections({ ocid: OCID, registered, partySizes: {}, partyShares: {} })
    const keys = sections.all.map((tile) => tile.bossKey)

    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('togglePick', () => {
  const limbo = { bossKey: 'limbo', difficulty: 'hard' }

  it('안 고른 보스를 누르면 그 캐릭터로 뒤에 붙는다', () => {
    expect(togglePick([], OCID, limbo)).toEqual([{ ...limbo, ocid: OCID }])
  })

  it('같은 캐릭터로 고른 보스를 다시 누르면 빠진다', () => {
    const picked = [{ ...limbo, ocid: OCID }]

    expect(togglePick(picked, OCID, limbo)).toEqual([])
  })

  it('같은 보스도 다른 캐릭터로는 따로 고른다', () => {
    const picked = [{ ...limbo, ocid: 'ocid-2' }]

    expect(togglePick(picked, OCID, limbo)).toEqual([
      { ...limbo, ocid: 'ocid-2' },
      { ...limbo, ocid: OCID },
    ])
    expect(isPicked(picked, OCID, 'limbo')).toBe(false)
    expect(isPicked(picked, 'ocid-2', 'limbo')).toBe(true)
  })
})
