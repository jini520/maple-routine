// 주인을 모르는 옛 가계부 기록. 넥슨 계정의 메이플 ID 가 하나뿐이면 그 ID 로, 그래도 남으면 화면이 대표로 세우는 캐릭터에게 붙인다.
jest.mock('../../auth/legacy-account-ids', () => ({ fillLegacyAccountIds: jest.fn(async () => undefined) }))
jest.mock('../../../storage/income', () => ({
  assignLegacyIncomeAccounts: jest.fn(async () => undefined),
  assignOwnerlessIncomes: jest.fn(async () => undefined),
}))
jest.mock('../../../storage/spend', () => ({
  assignLegacySpendAccounts: jest.fn(async () => undefined),
  assignOwnerlessSpends: jest.fn(async () => undefined),
}))
jest.mock('../../../storage/character-selection', () => ({
  getRepresentativeCharacter: jest.fn(),
  getTrackedCharacterOcids: jest.fn(),
}))
jest.mock('../../../storage/character-accounts', () => ({ getCharacterAccountSightings: jest.fn() }))

import { assignLegacyEntryAccounts } from '../legacy-entry-accounts'

const income = jest.requireMock('../../../storage/income') as Record<string, jest.Mock>
const spend = jest.requireMock('../../../storage/spend') as Record<string, jest.Mock>
const selection = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
const { getCharacterAccountSightings } = jest.requireMock('../../../storage/character-accounts') as Record<string, jest.Mock>

beforeEach(() => {
  jest.clearAllMocks()
  selection.getRepresentativeCharacter.mockResolvedValue(null)
  selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-첫째', 'ocid-대표'])
  getCharacterAccountSightings.mockResolvedValue([
    { ocid: 'ocid-첫째', name: '첫째', accountId: 'maple-첫째', firstSeenOn: '2026-01-01', lastSeenOn: '2026-11-01' },
    { ocid: 'ocid-대표', name: '대표', accountId: 'maple-대표', firstSeenOn: '2026-01-01', lastSeenOn: '2026-11-01' },
  ])
})

it('메이플 ID 가 하나뿐인 옮기기를 먼저 하고, 남은 기록을 대표 캐릭터에게 붙인다. 지출 컨텐츠도 메이플 ID 분류다', async () => {
  selection.getRepresentativeCharacter.mockResolvedValue('ocid-대표')

  await assignLegacyEntryAccounts()

  expect(spend.assignOwnerlessSpends).toHaveBeenCalledWith({ ocid: 'ocid-대표', accountId: 'maple-대표' }, ['event_bm', 'etc', 'content'])
  expect(income.assignOwnerlessIncomes).toHaveBeenCalledWith({ ocid: 'ocid-대표', accountId: 'maple-대표' }, ['etc'])
  expect(spend.assignLegacySpendAccounts.mock.invocationCallOrder[0]).toBeLessThan(spend.assignOwnerlessSpends.mock.invocationCallOrder[0]!)
})

// 대표를 고르지 않았으면 화면은 추적 목록의 첫 캐릭터를 대표로 세운다. 같은 캐릭터에게 붙여야 보이는 대표와 갈리지 않는다.
it('대표를 고르지 않았으면 화면이 대표로 세우는 첫 추적 캐릭터에게 붙인다', async () => {
  await assignLegacyEntryAccounts()

  expect(spend.assignOwnerlessSpends).toHaveBeenCalledWith({ ocid: 'ocid-첫째', accountId: 'maple-첫째' }, expect.anything())
})

it('대표 캐릭터가 없거나 그 메이플 ID 를 아직 모르면 붙이지 않고 다음에 켤 때 다시 본다', async () => {
  selection.getTrackedCharacterOcids.mockResolvedValue([])
  await assignLegacyEntryAccounts()
  expect(spend.assignOwnerlessSpends).not.toHaveBeenCalled()

  selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-모름'])
  await assignLegacyEntryAccounts()
  expect(spend.assignOwnerlessSpends).not.toHaveBeenCalled()
})
