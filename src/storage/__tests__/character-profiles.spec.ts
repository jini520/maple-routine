jest.mock('../sqlite/db', () => ({
  getBossProfitDb: jest.fn(),
}))
const { getBossProfitDb: getBossProfitDbMock } = jest.requireMock('../sqlite/db') as Record<string, jest.Mock>

const runMock = jest.fn()
const queryMock = jest.fn()
const fakeDb = { run: runMock, query: queryMock }

beforeEach(() => {
  runMock.mockReset().mockResolvedValue({ changes: { changes: 1 } })
  queryMock.mockReset().mockResolvedValue({ values: [] })
  getBossProfitDbMock.mockReset().mockResolvedValue(fakeDb)
})

describe('saveCharacterProfile', () => {
  it('같은 ocid 를 다시 쓰면 덮어쓴다. 캐릭터당 한 행이다', async () => {
    const { saveCharacterProfile } = require('../character-profiles') as typeof import('../character-profiles')

    await saveCharacterProfile({
      ocid: 'ocid-1',
      name: '루디',
      imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      world: '스카니아',
      level: 285,
      updatedAt: '2026-09-05T00:00:00.000Z',
    })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('ON CONFLICT(ocid) DO UPDATE SET')
    expect(values).toEqual([
      'ocid-1',
      '루디',
      'https://open.api.nexon.com/static/maplestory/character/look/abc',
      '스카니아',
      285,
      '2026-09-05T00:00:00.000Z',
    ])
  })

  // 이름이 빈 스냅샷은 행을 못 만든다. 그것을 심으면 화면에 이름 없는 행이 서고, 그때
  // 캐시에서 되찾을 길이 사라진다(표에 있으니 캐시를 안 읽는다).
  it('이름이 비면 쓰지 않는다', async () => {
    const { saveCharacterProfile } = require('../character-profiles') as typeof import('../character-profiles')

    await saveCharacterProfile({
      ocid: 'ocid-1',
      name: '',
      imageUrl: 'https://example.test/a.png',
      world: null,
      level: null,
      updatedAt: '2026-09-05T00:00:00.000Z',
    })

    expect(runMock).not.toHaveBeenCalled()
  })
})

describe('getCharacterProfiles', () => {
  it('목록 하나를 IN 한 번으로 읽는다. ocid 당 왕복이 아니다', async () => {
    const { getCharacterProfiles } = require('../character-profiles') as typeof import('../character-profiles')
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          name: '루디',
          image_url: 'https://example.test/a.png',
          world: '스카니아',
          level: 285,
          updated_at: '2026-09-05T00:00:00.000Z',
        },
      ],
    })

    const profiles = await getCharacterProfiles(['ocid-1', 'ocid-2'])

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('WHERE ocid IN (?, ?)')
    expect(values).toEqual(['ocid-1', 'ocid-2'])
    expect(profiles.get('ocid-1')).toEqual({
      ocid: 'ocid-1',
      name: '루디',
      imageUrl: 'https://example.test/a.png',
      world: '스카니아',
      level: 285,
      updatedAt: '2026-09-05T00:00:00.000Z',
    })
    expect(profiles.has('ocid-2')).toBe(false)
  })

  it('빈 목록이면 조회하지 않는다', async () => {
    const { getCharacterProfiles } = require('../character-profiles') as typeof import('../character-profiles')

    expect((await getCharacterProfiles([])).size).toBe(0)
    expect(queryMock).not.toHaveBeenCalled()
  })

  // level·world 는 nullable 이다. 0 으로 채우면 모름 이 레벨 0 으로 둔갑한다.
  it('월드와 레벨의 NULL 을 null 로 나른다', async () => {
    const { getCharacterProfiles } = require('../character-profiles') as typeof import('../character-profiles')
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          name: '루디',
          image_url: 'https://example.test/a.png',
          world: null,
          level: null,
          updated_at: '2026-09-05T00:00:00.000Z',
        },
      ],
    })

    const profile = (await getCharacterProfiles(['ocid-1'])).get('ocid-1')

    expect(profile?.world).toBeNull()
    expect(profile?.level).toBeNull()
  })
})
