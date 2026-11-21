import { bossDifficultyIdOf } from '../../lib/boss/bosses'
import { contentIdOf } from '../../lib/scheduler/contents'
import { installFakePreferences } from './fake-preferences'
import {
  getManualTrackedContent,
  moveManualTrackedContentToOcid,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../manual-tracked-content'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('manualTrackedContent:ocid-1')
  await prefs.remove('manualTrackedContent:ocid-2')
})

const SAMPLE_ITEMS: ManualTrackedItem[] = [
  { contentKey: 'monster_park', kind: 'daily' },
  { contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' },
  { contentKey: 'mu_lung_dojo', kind: 'weekly' },
  { kind: 'boss', bossKey: 'black_mage', difficulty: 'extreme' },
]

// 저장은 서버 `manual_tracked_items` 와 같은 칸이고 화면은 key 를 든다. 한 바퀴 돌아 다른 key 가 나오면 다른 컨텐츠를 추적한다.
describe('저장 모양', () => {
  it('종류와 줄 id(컨텐츠 줄 · 난이도 줄)로 적고 key 모양으로 되읽는다', async () => {
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)

    expect(JSON.parse((await prefs.get('manualTrackedContent:ocid-1'))!)).toEqual([
      { type: 'daily', targetId: contentIdOf('monster_park') },
      { type: 'daily', targetId: contentIdOf('daily_quest_road_of_vanishing') },
      { type: 'weekly', targetId: contentIdOf('mu_lung_dojo') },
      { type: 'boss', targetId: bossDifficultyIdOf('black_mage', 'extreme') },
    ])
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual(SAMPLE_ITEMS)
  })

  // 게임 데이터에서 빠진 줄은 key 로 되돌릴 수 없다. 화면은 표에 있는 항목만 편집한다.
  it('게임 데이터에 없는 줄 id 의 항목은 건너뛴다', async () => {
    await prefs.set(
      'manualTrackedContent:ocid-1',
      JSON.stringify([
        { type: 'weekly', targetId: '없는-id' },
        { type: 'boss', targetId: '없는-id' },
        { type: 'weekly', targetId: contentIdOf('mu_lung_dojo') },
      ]),
    )

    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([{ contentKey: 'mu_lung_dojo', kind: 'weekly' }])
  })

  // 대상 칸은 비울 수 없다. 조용히 빼면 사용자가 고른 항목이 저장되지 않은 채 화면에만 남는다.
  it('게임 데이터에 없는 key 를 적으려 하면 던진다', async () => {
    await expect(setManualTrackedContent('ocid-1', [{ contentKey: '없는-컨텐츠', kind: 'daily' }])).rejects.toThrow()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 빈 배열을 반환한다', async () => {
    await prefs.set('manualTrackedContent:ocid-1', 'not-valid-json{')
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([])
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setManualTrackedContent도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setManualTrackedContent('ocid-1', SAMPLE_ITEMS)).rejects.toThrow('disk full')
  })
})

// 리프 뒤에 새 캐릭터에 고른 목록은 사용자가 새로 정한 것이라 옛 목록으로 덮지 않는다.
describe('월드 리프 옮기기', () => {
  it('새 캐릭터에 목록이 없으면 옛 목록을 옮기고 옛 키를 지운다', async () => {
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)

    await moveManualTrackedContentToOcid('ocid-1', 'ocid-2')

    await expect(getManualTrackedContent('ocid-2')).resolves.toEqual(SAMPLE_ITEMS)
    expect(await prefs.get('manualTrackedContent:ocid-1')).toBeNull()
  })

  it('새 캐릭터에 목록이 있으면 새 목록을 두고 옛 키만 지운다', async () => {
    const fresh: ManualTrackedItem[] = [{ contentKey: 'mu_lung_dojo', kind: 'weekly' }]
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)
    await setManualTrackedContent('ocid-2', fresh)

    await moveManualTrackedContentToOcid('ocid-1', 'ocid-2')

    await expect(getManualTrackedContent('ocid-2')).resolves.toEqual(fresh)
    expect(await prefs.get('manualTrackedContent:ocid-1')).toBeNull()
  })
})
