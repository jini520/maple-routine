// 기기 기록을 서버 칸으로 옮기는 함수 둘. 계정을 잘못 실으면 캐릭터 기록이 엉뚱한 계정 단위 기록으로 집계된다.
import { bossClearHandler, bossClearPayloadOf } from '../boss-clear-sync'
import { cashbookEntryHandler, cashbookEntryPayloadOf } from '../cashbook-entry-sync'
import { enhancementTotalPayloadOf } from '../enhancement-total-sync'

jest.mock('../../../storage/server-sync-sources', () => ({ getBossClearSource: jest.fn(), getCashbookEntrySource: jest.fn() }))
jest.mock('../../../storage/enhancement-totals', () => ({ getEnhancementTotalById: jest.fn() }))
jest.mock('../../../server/records', () => ({
  sendBossClear: jest.fn(),
  deleteBossClear: jest.fn(),
  sendCashbookEntry: jest.fn(),
  deleteCashbookEntry: jest.fn(),
}))
const records = jest.requireMock('../../../server/records') as Record<string, jest.Mock>

const head = { id: 'e-1', ocid: null, entryType: 'spend' as const, categoryKey: 'buff', entryDate: '2026-10-26', createdAt: 't' }
const item = {
  itemKey: 'seiram_elixir', itemName: null, formKey: null, itemKindKey: null, quantity: 2, fromLevel: null, toLevel: null,
  amountMeso: 4_000_000, tariffMeso: null, saleFeePercent: null, saleFeeMeso: null, saleFeeAuto: false, amountPoint: null,
  pointPer100mMeso: null, amountCash: null,
}

it('캐릭터 없는 기록만 넥슨 계정 id 를 싣고, 사냥 입력과 자동 수수료 표시는 안 싣는다', () => {
  const account = cashbookEntryPayloadOf({ entry: { head, items: [item], hunt: null }, nexonAccountId: 'account-a' })
  const character = cashbookEntryPayloadOf({ entry: { head: { ...head, ocid: 'ocid-1' }, items: [item], hunt: null }, nexonAccountId: 'account-a' })

  expect(account.accountRecordId).toBe('account-a')
  expect(character.accountRecordId).toBeNull()
  expect(Object.keys(account)).not.toContain('hunt')
  expect(Object.keys(account.items[0] ?? {})).not.toContain('saleFeeAuto')
})

it('처치 기간은 칸 이름만 서버 쪽으로 바꾼다', () => {
  expect(
    bossClearPayloadOf({
      periodId: 'pe-1', ocid: 'o', bossKey: 'lucid', difficulty: 'hard', cycle: 'weekly', periodKey: '2026-10-22',
      worldKey: null, priceMeso: 300, payoutMeso: 150, splitMode: 'even', partySize: 2, myShare: null, sharesTotal: null,
      splitFeePercent: 3, defeatedDate: null, source: 'auto',
    }),
  ).toMatchObject({ periodRecordId: 'pe-1', boss: 'lucid', difficulty: 'hard', payoutMeso: 150 })
})

// 읽기가 null 이면 그 기록이 기기에서 사라졌거나 처치가 아니게 된 것이라 서버에서 지운다.
it('값이 없으면 지우기, 있으면 덮어 적기를 보낸다', async () => {
  await bossClearHandler.send({}, 'pe-1', null)
  await cashbookEntryHandler.send({}, 'e-1', null)

  expect(records.deleteBossClear).toHaveBeenCalledWith({}, 'pe-1')
  expect(records.deleteCashbookEntry).toHaveBeenCalledWith({}, 'e-1')
  expect(records.sendBossClear).not.toHaveBeenCalled()
})

// 서버는 여러 사용자의 지출 통계를 낸다. 이벤트 월드 지출이 섞이거나 사람마다 다른 MVP 할인이 붙으면 통계가 틀린다.
describe('강화 합계', () => {
  const total = {
    id: 't-1', nexonAccountId: 'account-a', historyDate: '2026-10-20', characterName: '낟낟',
    enhancementType: 'starforce' as const, enhancementCategory: 'starforce' as const, itemGroup: 'key:arcane_umbra_knuckle',
    itemKey: 'arcane_umbra_knuckle', itemName: '아케인셰이드 클로', attempts: 3, attemptCostMeso: 1_000_000,
    destroyDefenceCostMeso: 2_000_000, eventWorld: false,
  }

  it('지출로 세는 줄은 저장된 MVP 할인 전 두 몫을 그대로 싣는다', () => {
    expect(enhancementTotalPayloadOf(total)).toEqual({
      totalRecordId: 't-1', accountRecordId: 'account-a', characterName: '낟낟', historyDate: '2026-10-20',
      enhancementCategory: 'starforce', itemKey: 'arcane_umbra_knuckle', itemName: '아케인셰이드 클로', attempts: 3,
      attemptCostMeso: 1_000_000, destroyDefenceCostMeso: 2_000_000,
    })
  })

  // null 이면 전송이 지우기를 보낸다. 판정이 나중에 이벤트 월드로 바뀐 줄도 서버에서 빠진다.
  it('이벤트 월드거나 판정하지 못한 줄은 보내지 않는다', () => {
    expect(enhancementTotalPayloadOf({ ...total, eventWorld: true })).toBeNull()
    expect(enhancementTotalPayloadOf({ ...total, eventWorld: null })).toBeNull()
  })

  // 강화권 · 120 레벨 이하 큐브는 메소가 안 들어 지출이 아니다. 횟수만 있는 줄이 통계를 흐린다.
  it('비용이 0 인 줄은 보내지 않는다. 파괴 방지 비용만 있어도 보낸다', () => {
    expect(enhancementTotalPayloadOf({ ...total, attemptCostMeso: 0, destroyDefenceCostMeso: 0 })).toBeNull()
    expect(enhancementTotalPayloadOf({ ...total, attemptCostMeso: 0 })).not.toBeNull()
  })
})
