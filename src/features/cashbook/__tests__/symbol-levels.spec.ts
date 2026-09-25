// 심볼 강화 드롭다운이 쓰는 캐릭터의 심볼 레벨. 화면은 `nexon/` 도 `storage/` 도 직접 안 부른다.
import type { NexonCredential } from '../../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ kind: 'apiKey', value })
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../nexon/symbol-levels', () => ({ fetchSymbolEquipment: jest.fn() }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { fetchSymbolEquipment } = jest.requireMock('../../../nexon/symbol-levels') as Record<string, jest.Mock>

const { loadSymbolLevels } = require('../symbol-levels') as typeof import('../symbol-levels')

beforeEach(() => {
  getAuthConfig.mockReset().mockResolvedValue({ apiKey: 'api-key' })
  fetchSymbolEquipment.mockReset().mockResolvedValue([
    { symbol_name: '아케인심볼 : 소멸의 여로', symbol_level: 20 },
    { symbol_name: '어센틱심볼 : 세르니움', symbol_level: 4 },
  ])
})

it('읽으면 심볼 key 별 레벨이다', async () => {
  await expect(loadSymbolLevels('ocid-1')).resolves.toEqual({ road_of_vanishing: 20, cernium: 4 })
  expect(fetchSymbolEquipment).toHaveBeenCalledWith(자격('api-key'), 'ocid-1')
})

it('키가 없으면 부르지 않고 모른다', async () => {
  getAuthConfig.mockResolvedValue(null)

  await expect(loadSymbolLevels('ocid-1')).resolves.toBeNull()
  expect(fetchSymbolEquipment).not.toHaveBeenCalled()
})

// 만렙 묶음만 없이 선다. 던지면 시트가 캐릭터를 고르는 순간 깨진다.
it('호출이 실패하면 던지지 않고 모른다', async () => {
  fetchSymbolEquipment.mockRejectedValue(new Error('boom'))

  await expect(loadSymbolLevels('ocid-1')).resolves.toBeNull()
})
