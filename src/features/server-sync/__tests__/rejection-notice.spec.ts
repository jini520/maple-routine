/**
 * 두 거절의 알림 문구와 기록 이름.
 *
 * 오프라인에서 적은 기록은 연결된 뒤에 거절이 와서, 이름이 없으면 무엇이 바뀌었는지 알 수 없다. 사용자가 친 값이 아닌 기록은 막힌
 * 입력이 없어 알리지 않는다.
 */
import { bossDifficultyIdOf } from '../../../lib/boss/bosses'
import { findItem, ringLevelItemOf } from '../../../lib/item-catalog'
import { cashbookCategoriesTable, cashbookCategoryOf } from '../../../lib/cashbook/categories'
import { recordNameOf, rejectionMessagesOf, type RecordNameDeps } from '../rejection-notice'

const DEPS: RecordNameDeps = { characterNameOf: async (ocid) => (ocid === 'ocid-1' ? '하나' : null) }
const LUCID_HARD = bossDifficultyIdOf('lucid', 'hard')!

describe('기록 이름', () => {
  it('처치는 손으로 적은 것만 보스 · 난이도로 이름 짓고, 자동으로 적은 처치는 알리지 않는다', async () => {
    const entry = { id: 'e', boss_difficulty_id: LUCID_HARD }

    await expect(recordNameOf('bossProfitEntries', { ...entry, clear_recorded_by: 'manual' }, DEPS)).resolves.toBe(
      '루시드 하드 처치 기록',
    )
    await expect(recordNameOf('bossProfitEntries', { ...entry, clear_recorded_by: 'auto' }, DEPS)).resolves.toBe('silent')
  })

  // 처치를 적는 보스 수익 화면이 정식 이름을 쓴다. 알림도 같은 이름이어야 어느 줄인지 찾는다.
  it('보스는 짧은 이름이 아니라 보스 수익 화면과 같은 정식 이름으로 짓는다', async () => {
    const slime = bossDifficultyIdOf('guardian_angel_slime', 'chaos')!

    await expect(
      recordNameOf('bossProfitEntries', { id: 'e', boss_difficulty_id: slime, clear_recorded_by: 'manual' }, DEPS),
    ).resolves.toBe('가디언 엔젤 슬라임 카오스 처치 기록')
  })

  // 처치 전 수익 건은 그 주의 분배만 든 줄이다. 분배를 고친 입력이라 분배 설정의 이름을 쓴다.
  it('처치 전 수익 건은 분배 설정으로 이름 짓는다', async () => {
    await expect(
      recordNameOf('bossProfitEntries', { id: 'e', boss_difficulty_id: LUCID_HARD, clear_recorded_by: null }, DEPS),
    ).resolves.toBe('루시드 하드 분배 설정')
  })

  it('넥슨에서 받아 기기가 적는 기록은 알리지 않는다', async () => {
    for (const table of ['enhancementTotals', 'sharedContentProgress', 'rememberedLevels']) {
      await expect(recordNameOf(table, { id: 'x' }, DEPS)).resolves.toBe('silent')
    }
  })

  it('드롭 · 분배 설정 · 인벤토리 · MVP 등급 · 월드 리프를 표의 이름으로 짓는다', async () => {
    const item = findItem('soul_ether_1')!
    await expect(recordNameOf('bossDrops', { id: 'd', item_id: item.id }, DEPS)).resolves.toBe(`${item.name} 드롭 기록`)
    await expect(recordNameOf('bossSplitSettings', { id: 's', boss_difficulty_id: LUCID_HARD }, DEPS)).resolves.toBe(
      '루시드 하드 분배 설정',
    )
    await expect(recordNameOf('inventoryItems', { id: 'i', item_id: item.id }, DEPS)).resolves.toBe(`${item.name} 인벤토리 기록`)
    await expect(recordNameOf('mvpGradeHistory', { id: 'm' }, DEPS)).resolves.toBe('MVP 등급 기록')
    await expect(recordNameOf('characterWorldLeaps', { id: 'l', ocid: 'ocid-1' }, DEPS)).resolves.toBe('하나 월드 리프 연결')
  })

  // 같은 반지도 레벨마다 다른 물건이라 목록 줄 · 기록 줄이 레벨을 보인다.
  it('특수스킬 반지의 레벨 줄은 레벨을 붙인다', async () => {
    const ring = findItem('restraint_ring')
    const level = ring === null ? null : ringLevelItemOf(ring, 4)
    if (ring === null || level === null) throw new Error('반지 줄이 게임 데이터에 없다')

    await expect(recordNameOf('bossDrops', { id: 'd', item_id: level.id }, DEPS)).resolves.toBe(`${ring.name} Lv.4 드롭 기록`)
  })

  it('가계부는 날짜와 분류로, 약속은 요일이나 날짜와 시각으로, 계산 기록은 저장한 날로 짓는다', async () => {
    const hunting = cashbookCategoryOf('income', 'hunting')!
    await expect(
      recordNameOf('cashbookEntries', { id: 'c', date: '2026-11-20', category_id: categoryIdOf('hunting') }, DEPS),
    ).resolves.toBe(`11월 20일 ${hunting.name} 기록`)
    await expect(
      recordNameOf('partyAppointments', { id: 'a', time: '21:00', schedule: { type: 'weekly', weekday: 4 } }, DEPS),
    ).resolves.toBe('목요일 21:00 파티 약속')
    await expect(
      recordNameOf('partyAppointments', { id: 'a', time: '21:00', schedule: { type: 'once', date: '2026-11-20' } }, DEPS),
    ).resolves.toBe('11월 20일 21:00 파티 약속')
    // 저장한 시각은 UTC 로 적혀 있다. 한국 시각으로 다음 날이면 다음 날이다.
    await expect(
      recordNameOf('bossProfitCalculatorRecords', { id: 'r', savedAt: '2026-11-20T16:00:00.000Z' }, DEPS),
    ).resolves.toBe('11월 21일 보스 수익 계산 기록')
  })

  it('이름의 재료가 기기에 없거나 표에 없는 기록이면 이름을 짓지 않는다', async () => {
    await expect(recordNameOf('bossDrops', { id: 'd', item_id: '없는-id' }, DEPS)).resolves.toBeNull()
    await expect(recordNameOf('characterWorldLeaps', { id: 'l', ocid: 'ocid-모름' }, DEPS)).resolves.toBeNull()
    await expect(recordNameOf('bossDrops', null, DEPS)).resolves.toBeNull()
  })
})

describe('알림 문구', () => {
  it('거절마다 한 문구이고, 한 건이면 이름을 넣고 여러 건이거나 이름이 없으면 건수로 쓴다', () => {
    expect(
      rejectionMessagesOf([
        { code: 'duplicate_record', name: '루시드 하드 처치 기록' },
        { code: 'record_deleted', name: '목요일 21:00 파티 약속' },
        { code: 'record_deleted', name: null },
      ]),
    ).toEqual([
      '루시드 하드 처치 기록은 다른 기기에서 먼저 적어, 그 기록으로 바꿨습니다',
      '기록 2건은 다른 기기에서 지워, 고친 내용을 저장하지 못했습니다',
    ])
    expect(rejectionMessagesOf([{ code: 'record_deleted', name: null }])).toEqual([
      '기록 1건은 다른 기기에서 지워, 고친 내용을 저장하지 못했습니다',
    ])
    expect(rejectionMessagesOf([])).toEqual([])
  })
})

/** 수입 분류의 줄 id. 가계부 기록은 분류를 줄 id 로 가리킨다. */
function categoryIdOf(key: string): string {
  const row = cashbookCategoriesTable.get().cashbookCategories.find((one) => one.key === key && one.entryType === 'income')
  if (row === undefined) throw new Error(`분류 표에 없다: ${key}`)
  return row.id
}
