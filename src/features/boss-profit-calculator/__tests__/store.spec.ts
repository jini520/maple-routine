// 계산기 상태. 보스 관리 값으로 시작하되 고친 값은 계산기와 기록에만 남는다.
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { getBossProfitCalculatorRecords, type BossProfitCalculatorRecord } from '../../../storage/boss-profit-calculator-records'
import { matchBossContent, type MatchedBoss } from '../../../lib/boss/boss-matching'
import { bossKeyOfApiName } from '../../../lib/boss/bosses'
import { partySizeKey, useBossSchedulerStore, type BossCharacterView } from '../../boss-scheduler/store'
import { useTrackingModeStore } from '../../tracking-mode/store'
import type { BossDifficulty } from '../../../types'
import { bossWithPartySetting, useBossProfitCalculatorStore } from '../store'

const NOW = new Date('2026-10-20T12:00:00+09:00')
const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function registered(name: string, difficulty: BossDifficulty): MatchedBoss {
  return matchBossContent({
    bossKey: bossKeyOfApiName(name),
    apiName: name,
    difficulty,
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
  })
}

function character(ocid: string, weeklyBosses: MatchedBoss[]): BossCharacterView {
  return {
    ocid,
    characterName: ocid,
    weeklyBosses,
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
  }
}

const 카링 = registered('카링', 'normal')
const 루시드 = registered('루시드', 'hard')

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
  installNoopNativePorts()
  useTrackingModeStore.setState({ mode: 'auto' })
  useBossSchedulerStore.setState({
    characters: [character('ocid-1', [카링, 루시드]), character('ocid-2', [루시드])],
    partySizes: { [partySizeKey('ocid-1', 'kaling', 'normal')]: 3 },
    partyShares: {
      [partySizeKey('ocid-1', 'kaling', 'normal')]: { crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 3 },
    },
    manualTrackedByOcid: {},
  })
  useBossProfitCalculatorStore.setState({ loaded: false, records: [], openedId: null, bossesByOcid: {} })
})

function bossesOf(ocid: string): string[] {
  return (useBossProfitCalculatorStore.getState().bossesByOcid[ocid] ?? []).map((one) => `${one.bossKey}:${one.difficulty}:${one.partySize}`)
}

/** 계산기를 열고 두 캐릭터를 보스 관리 값으로 채운다. 계산기는 빈 상태로 열린다 */
async function openFilled(): Promise<void> {
  await useBossProfitCalculatorStore.getState().open()
  useBossProfitCalculatorStore.getState().importFromBossManage('ocid-1', NOW)
  useBossProfitCalculatorStore.getState().importFromBossManage('ocid-2', NOW)
}

const 옛것: BossProfitCalculatorRecord = {
  id: 'old',
  savedAt: '2026-10-18T00:00:00.000Z',
  characters: [{ ocid: 'ocid-1', bosses: [] }],
}
const 새것: BossProfitCalculatorRecord = {
  id: 'new',
  savedAt: '2026-10-19T00:00:00.000Z',
  characters: [{ ocid: 'ocid-1', bosses: [{ bossKey: 'kaling', difficulty: 'normal', partySize: 2, shares: EVEN }] }],
}

describe('처음 값', () => {
  // 캐릭터 하나만 따져 볼 때 다른 캐릭터의 값을 먼저 걷어 내지 않아도 되게 한다(사용자 결정).
  it('기록이 있어도 모든 캐릭터가 빈 상태로 열리고 연 기록이 없다', async () => {
    await prefs.set('bossProfitCalculatorRecords', JSON.stringify([옛것, 새것]))

    await useBossProfitCalculatorStore.getState().open()

    expect(bossesOf('ocid-1')).toEqual([])
    expect(bossesOf('ocid-2')).toEqual([])
    expect(useBossProfitCalculatorStore.getState().openedId).toBeNull()
    expect(useBossProfitCalculatorStore.getState().records.map((one) => one.id)).toEqual(['new', 'old'])
  })

  it('기록을 열면 기록에 있는 캐릭터는 그 값이고, 기록 뒤에 추적을 시작한 캐릭터는 비어 있다', async () => {
    await prefs.set('bossProfitCalculatorRecords', JSON.stringify([옛것, 새것]))
    await useBossProfitCalculatorStore.getState().open()

    useBossProfitCalculatorStore.getState().openRecord('new')

    expect(useBossProfitCalculatorStore.getState().openedId).toBe('new')
    expect(bossesOf('ocid-1')).toEqual(['kaling:normal:2'])
    expect(bossesOf('ocid-2')).toEqual([])
  })
})

describe('고친 값', () => {
  it('보스 관리의 파티 설정에 쓰지 않는다', async () => {
    await openFilled()
    const before = useBossSchedulerStore.getState().partySizes

    useBossProfitCalculatorStore.getState().updateBoss('ocid-1', 'kaling', { partySize: 6 })

    expect(bossesOf('ocid-1')).toContain('kaling:normal:6')
    expect(useBossSchedulerStore.getState().partySizes).toBe(before)
  })

  // 보스 선택 시트는 고른 순서로 돌려준다. 줄은 보스 표 순서를 지킨다.
  it('보스 선택에서 고른 보스를 보스 표 순서로 놓는다', async () => {
    await openFilled()

    useBossProfitCalculatorStore.getState().setBosses('ocid-2', [
      { bossKey: 'kaling', difficulty: 'normal', partySize: 1, shares: EVEN },
      { bossKey: 'lotus', difficulty: 'hard', partySize: 1, shares: EVEN },
    ])

    expect(bossesOf('ocid-2')).toEqual(['lotus:hard:1', 'kaling:normal:1'])
  })
})

describe('bossWithPartySetting', () => {
  // 보스 선택에서 새로 고른 보스가 들고 오는 값.
  it('보스 관리에 파티 설정이 있으면 그 인원과 비율, 없으면 1인이다', () => {
    expect(bossWithPartySetting('ocid-1', 'kaling', 'normal')).toEqual({
      bossKey: 'kaling',
      difficulty: 'normal',
      partySize: 3,
      shares: { myShare: 2, sharesTotal: 5, splitFeePercent: 3 },
    })
    expect(bossWithPartySetting('ocid-2', 'kaling', 'normal')).toEqual({
      bossKey: 'kaling',
      difficulty: 'normal',
      partySize: 1,
      shares: EVEN,
    })
  })
})

describe('캐릭터 하나에만 걸리는 버튼', () => {
  it('초기화는 그 캐릭터의 보스만 모두 뺀다', async () => {
    await openFilled()

    useBossProfitCalculatorStore.getState().clearCharacter('ocid-1')

    expect(bossesOf('ocid-1')).toEqual([])
    expect(bossesOf('ocid-2')).toEqual(['lucid:hard:1'])
  })

  it('보스 관리 값 가져오기는 그 캐릭터만 다시 채운다', async () => {
    await openFilled()
    useBossProfitCalculatorStore.getState().clearCharacter('ocid-1')
    useBossProfitCalculatorStore.getState().clearCharacter('ocid-2')

    useBossProfitCalculatorStore.getState().importFromBossManage('ocid-1', NOW)

    expect(bossesOf('ocid-1')).toEqual(['lucid:hard:1', 'kaling:normal:3'])
    expect(useBossProfitCalculatorStore.getState().bossesByOcid['ocid-1']?.[1]?.shares).toEqual({
      myShare: 2,
      sharesTotal: 5,
      splitFeePercent: 3,
    })
    expect(bossesOf('ocid-2')).toEqual([])
  })
})

describe('결과 저장', () => {
  it('연 기록이 없으면 uuid 를 단 새 기록을 남기고 그 기록을 연 상태가 된다', async () => {
    await openFilled()

    await useBossProfitCalculatorStore.getState().save('new', NOW)

    const saved = await getBossProfitCalculatorRecords()
    expect(saved).toHaveLength(1)
    expect(saved[0]?.id).toMatch(UUID)
    expect(saved[0]?.savedAt).toBe(NOW.toISOString())
    expect(useBossProfitCalculatorStore.getState().openedId).toBe(saved[0]?.id)
  })

  it('덮기는 연 기록의 값과 저장 시각을 바꾸고, 새 기록으로는 하나를 더한다', async () => {
    await openFilled()
    await useBossProfitCalculatorStore.getState().save('new', NOW)
    const firstId = useBossProfitCalculatorStore.getState().openedId
    const later = new Date(NOW.getTime() + 60_000)

    useBossProfitCalculatorStore.getState().clearCharacter('ocid-2')
    await useBossProfitCalculatorStore.getState().save('overwrite', later)

    let saved = await getBossProfitCalculatorRecords()
    expect(saved).toHaveLength(1)
    expect(saved[0]?.id).toBe(firstId)
    expect(saved[0]?.savedAt).toBe(later.toISOString())
    expect(saved[0]?.characters.find((one) => one.ocid === 'ocid-2')?.bosses).toEqual([])

    await useBossProfitCalculatorStore.getState().save('new', later)

    saved = await getBossProfitCalculatorRecords()
    expect(saved).toHaveLength(2)
    expect(useBossProfitCalculatorStore.getState().openedId).not.toBe(firstId)
  })
})

describe('기록 목록', () => {
  it('기록을 열면 그 값으로 채우고, 연 기록을 지우면 연 기록이 없어진다', async () => {
    await openFilled()
    await useBossProfitCalculatorStore.getState().save('new', NOW)
    const id = useBossProfitCalculatorStore.getState().openedId!
    useBossProfitCalculatorStore.getState().clearCharacter('ocid-1')

    useBossProfitCalculatorStore.getState().openRecord(id)
    expect(bossesOf('ocid-1')).toEqual(['lucid:hard:1', 'kaling:normal:3'])

    await useBossProfitCalculatorStore.getState().deleteRecord(id)
    expect(await getBossProfitCalculatorRecords()).toEqual([])
    expect(useBossProfitCalculatorStore.getState().openedId).toBeNull()
  })
})
