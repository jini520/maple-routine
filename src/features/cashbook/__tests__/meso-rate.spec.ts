// 사냥 계산기가 쓰는 메소 획득량의 **오케스트레이션**.
//
// 화면은 `nexon/` 도 `storage/` 도 직접 안 부른다(CLAUDE.md CRITICAL) — 그 셋을 잇는 이 자리만
// 검증하면 된다.
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/meso-rate-cache', () => ({
  getCachedMesoRate: jest.fn(),
  setCachedMesoRate: jest.fn(),
}))
jest.mock('../../../nexon/meso-rate', () => ({ fetchMesoRate: jest.fn() }))
jest.mock('../../../storage/character-basic-cache', () => ({ getCachedCharacterBasic: jest.fn() }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { getCachedMesoRate, setCachedMesoRate } = jest.requireMock(
  '../../../storage/meso-rate-cache',
) as Record<string, jest.Mock>
const { fetchMesoRate } = jest.requireMock('../../../nexon/meso-rate') as Record<string, jest.Mock>
const { getCachedCharacterBasic } = jest.requireMock(
  '../../../storage/character-basic-cache',
) as Record<string, jest.Mock>

const { loadMesoRate } = require('../meso-rate') as typeof import('../meso-rate')

beforeEach(() => {
  getAuthConfig.mockReset().mockResolvedValue({ apiKey: 'api-key' })
  getCachedMesoRate.mockReset().mockResolvedValue(null)
  setCachedMesoRate.mockReset().mockResolvedValue(undefined)
  fetchMesoRate.mockReset().mockResolvedValue(149)
  getCachedCharacterBasic.mockReset().mockResolvedValue(null)
})

it('읽히면 자동값이다 — 그 값으로 캐시를 갱신한다', async () => {
  await expect(loadMesoRate('ocid-1')).resolves.toEqual({ kind: 'read', percent: 149 })

  expect(fetchMesoRate).toHaveBeenCalledWith('api-key', 'ocid-1', null)
  expect(setCachedMesoRate).toHaveBeenCalledWith('ocid-1', 149)
})

it('호출이 실패하면 손입력으로 내려가고 기본값은 마지막 성공값이다', async () => {
  fetchMesoRate.mockRejectedValue(new Error('boom'))
  getCachedMesoRate.mockResolvedValue(161)

  await expect(loadMesoRate('ocid-1')).resolves.toEqual({ kind: 'fallback', percent: 161 })
  // 실패한 값으로 캐시를 덮지 않는다 — 마지막 성공값이 사라지면 폴백 칸이 빈다.
  expect(setCachedMesoRate).not.toHaveBeenCalled()
})

it('실패했는데 마지막 성공값도 없으면 빈 칸이다', async () => {
  fetchMesoRate.mockRejectedValue(new Error('boom'))

  await expect(loadMesoRate('ocid-1')).resolves.toEqual({ kind: 'fallback', percent: null })
})

it('키가 없으면 부르지도 않는다 — 401 을 만들어 키를 지우게 두지 않는다', async () => {
  getAuthConfig.mockResolvedValue(null)
  getCachedMesoRate.mockResolvedValue(149)

  await expect(loadMesoRate('ocid-1')).resolves.toEqual({ kind: 'fallback', percent: 149 })
  expect(fetchMesoRate).not.toHaveBeenCalled()
})

// 메획을 안 두른 캐릭터가 실제로 있다. `0 을 읽었다`와 `못 읽었다`는 다른 상태다.
it('0 을 읽은 것은 성공이다 — 손입력으로 안 내려간다', async () => {
  fetchMesoRate.mockResolvedValue(0)

  await expect(loadMesoRate('ocid-1')).resolves.toEqual({ kind: 'read', percent: 0 })
  expect(setCachedMesoRate).toHaveBeenCalledWith('ocid-1', 0)
})

it('캐시 쓰기가 실패해도 읽은 값은 그대로 낸다', async () => {
  setCachedMesoRate.mockRejectedValue(new Error('디스크 꽉참'))

  await expect(loadMesoRate('ocid-1')).resolves.toEqual({ kind: 'read', percent: 149 })
})

// `그리드`는 직업이 정하는 값이라 스킬 조회를 안 거친다(사용자 지정 2026-09-01) — 직업 이름은
// `character/list` 가 캐시에 남겨 둔 것을 그대로 쓴다.
it('캐시에 든 직업 이름을 함께 넘긴다', async () => {
  getCachedCharacterBasic.mockResolvedValue({ profile: { name: '루디', level: 294, jobClass: '섀도어' } })

  await loadMesoRate('ocid-1')

  expect(fetchMesoRate).toHaveBeenCalledWith('api-key', 'ocid-1', '섀도어')
})

it('캐시가 아직 안 따뜻하면 직업을 모르는 채로 부른다 — 아무 값이나 얹지 않는다', async () => {
  getCachedCharacterBasic.mockResolvedValue({ profile: { name: '루디', level: 294 } })

  await loadMesoRate('ocid-1')

  expect(fetchMesoRate).toHaveBeenCalledWith('api-key', 'ocid-1', null)
})

it('직업 캐시를 못 읽어도 메획 조회는 그대로 돈다', async () => {
  getCachedCharacterBasic.mockRejectedValue(new Error('디스크 깨짐'))

  await expect(loadMesoRate('ocid-1')).resolves.toEqual({ kind: 'read', percent: 149 })
  expect(fetchMesoRate).toHaveBeenCalledWith('api-key', 'ocid-1', null)
})
