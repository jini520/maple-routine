// 심볼 · 헥사 코어의 강화 레벨 기억. 추적을 시작할 때 넥슨 값으로 채우고, 그 뒤로는 사용자가 저장한 기록을 따른다.
import type { SpendRecord } from '../../../storage/spend'

jest.mock('../../auth/current-credential', () => ({ currentCredential: jest.fn() }))
jest.mock('../../../nexon/symbol-levels', () => ({ fetchSymbolEquipment: jest.fn() }))
jest.mock('../../../nexon/hexamatrix', () => ({ fetchHexaMatrix: jest.fn() }))
jest.mock('../../../storage/remembered-levels', () => ({
  getRememberedLevels: jest.fn(),
  hasRememberedLevels: jest.fn(),
  rememberLevels: jest.fn(),
}))
jest.mock('../../../storage/spend', () => ({ getLatestSpendFor: jest.fn() }))

const { currentCredential } = jest.requireMock('../../auth/current-credential') as Record<string, jest.Mock>
const { fetchSymbolEquipment } = jest.requireMock('../../../nexon/symbol-levels') as Record<string, jest.Mock>
const { fetchHexaMatrix } = jest.requireMock('../../../nexon/hexamatrix') as Record<string, jest.Mock>
const storage = jest.requireMock('../../../storage/remembered-levels') as Record<string, jest.Mock>
const { getLatestSpendFor } = jest.requireMock('../../../storage/spend') as Record<string, jest.Mock>

const {
  loadRememberedLevels,
  rememberAfterRemove,
  rememberAfterSave,
  latestLevelRecordId,
  seedRememberedLevels,
} = require('../remembered-levels') as typeof import('../remembered-levels')

const 자격 = { type: 'key', value: 'api-key', accountId: 'account-key' }

beforeEach(() => {
  currentCredential.mockReset().mockResolvedValue(자격)
  fetchSymbolEquipment.mockReset().mockResolvedValue([{ symbol_name: '어센틱심볼 : 세르니움', symbol_level: 4 }])
  fetchHexaMatrix.mockReset().mockResolvedValue([
    { hexa_core_name: '셀레스티얼 클리브 ', hexa_core_level: 9, hexa_core_event_level: 3, hexa_core_type: '스킬 코어' },
  ])
  storage.getRememberedLevels.mockReset().mockResolvedValue({})
  storage.hasRememberedLevels.mockReset().mockResolvedValue(false)
  storage.rememberLevels.mockReset().mockResolvedValue(undefined)
  getLatestSpendFor.mockReset().mockResolvedValue(null)
})

describe('seedRememberedLevels: 추적을 시작할 때', () => {
  it('기억이 없는 캐릭터는 심볼 · 헥사를 넥슨에서 받아 빈 자리만 채운다. 헥사는 이벤트 레벨을 뺀 레벨이다', async () => {
    await seedRememberedLevels(['ocid-1'])

    expect(storage.rememberLevels).toHaveBeenCalledWith('ocid-1', 'symbol', { cernium: 4 }, 'fill')
    expect(storage.rememberLevels).toHaveBeenCalledWith('ocid-1', 'hexa', { '셀레스티얼 클리브': 9 }, 'fill')
  })

  // 다시 추적하는 캐릭터의 기억은 사용자가 쌓은 값이다. 넥슨 값으로 덮지 않는다.
  it('기억이 하나라도 있으면 받지 않는다', async () => {
    storage.hasRememberedLevels.mockResolvedValue(true)

    await seedRememberedLevels(['ocid-1'])

    expect(fetchSymbolEquipment).not.toHaveBeenCalled()
    expect(fetchHexaMatrix).not.toHaveBeenCalled()
  })

  // 추적 저장의 곁가지다. 던지면 캐릭터 저장이 실패한 것처럼 읽힌다.
  it('한쪽 호출이 실패해도 던지지 않고 받은 쪽은 채운다', async () => {
    fetchHexaMatrix.mockRejectedValue(new Error('boom'))

    await expect(seedRememberedLevels(['ocid-1'])).resolves.toBeUndefined()
    expect(storage.rememberLevels).toHaveBeenCalledTimes(1)
  })
})

describe('loadRememberedLevels: 폼을 열 때', () => {
  it('기억이 있으면 넥슨을 부르지 않는다', async () => {
    storage.getRememberedLevels.mockResolvedValue({ cernium: 7 })

    await expect(loadRememberedLevels('ocid-1', 'symbol')).resolves.toEqual({ cernium: 7 })
    expect(fetchSymbolEquipment).not.toHaveBeenCalled()
  })

  // 추적을 시작할 때 받기가 실패했거나 이 기능 전부터 추적하던 캐릭터다.
  it('기억이 비어 있으면 한 번 받아 채우고 그 값을 돌려준다', async () => {
    storage.getRememberedLevels.mockResolvedValueOnce({}).mockResolvedValueOnce({ '셀레스티얼 클리브': 9 })

    await expect(loadRememberedLevels('ocid-1', 'hexa')).resolves.toEqual({ '셀레스티얼 클리브': 9 })
    expect(storage.rememberLevels).toHaveBeenCalledWith('ocid-1', 'hexa', { '셀레스티얼 클리브': 9 }, 'fill')
  })
})

const 헥사: SpendRecord = {
  id: 'spd-1',
  ocid: 'ocid-1',
  spentOn: '2026-10-30',
  category: 'hexa_matrix',
  item: null,
  itemKey: '매화검 본초 : 선참 VI',
  formItemKeys: null,
  itemKind: null,
  levelFrom: 25,
  levelTo: 28,
  quantity: null,
  mesoAmount: 0,
  tariffMeso: null,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  hexa: { fragmentCount: 345, untradableFragmentCount: 0, fragmentPrice: 0, activation: null },
  recordedAt: '2026-10-30T00:00:00.000Z',
}

describe('기록이 기억을 옮긴다', () => {
  it('저장하면 강화 후 레벨이 기억이 된다. 심볼은 심볼 key, 헥사 스킬은 코어 이름이다', async () => {
    await rememberAfterSave(헥사)
    await rememberAfterSave({ ...헥사, category: 'symbol', itemKey: 'cernium', levelFrom: 3, levelTo: 5, hexa: null })

    expect(storage.rememberLevels).toHaveBeenCalledWith('ocid-1', 'hexa', { '매화검 본초 : 선참 VI': 28 }, 'overwrite')
    expect(storage.rememberLevels).toHaveBeenCalledWith('ocid-1', 'symbol', { cernium: 5 }, 'overwrite')
  })

  it('헥사 스탯 · 캐릭터 없는 기록 · 다른 갈래는 기억을 안 건드린다', async () => {
    await rememberAfterSave({ ...헥사, itemKey: 'hexa_stat_1', levelFrom: null, levelTo: null, hexa: { ...헥사.hexa!, activation: true } })
    await rememberAfterSave({ ...헥사, ocid: null })
    await rememberAfterSave({ ...헥사, category: 'etc', hexa: null })

    expect(storage.rememberLevels).not.toHaveBeenCalled()
  })

  // 더 옛 기록을 지우면 그 뒤 기록이 이미 레벨을 옮겼다. 기억을 되돌리면 틀린다.
  it('지운 기록이 가장 최근이었을 때만 기억이 그 기록의 강화 전으로 돌아간다', async () => {
    getLatestSpendFor.mockResolvedValue({ ...헥사 })
    const latestId = await latestLevelRecordId(헥사)
    await rememberAfterRemove(헥사, latestId)
    expect(storage.rememberLevels).toHaveBeenCalledWith('ocid-1', 'hexa', { '매화검 본초 : 선참 VI': 25 }, 'overwrite')

    storage.rememberLevels.mockClear()
    getLatestSpendFor.mockResolvedValue({ ...헥사, id: 'spd-later' })
    await rememberAfterRemove(헥사, await latestLevelRecordId(헥사))
    expect(storage.rememberLevels).not.toHaveBeenCalled()
  })
})
