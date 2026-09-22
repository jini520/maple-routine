jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getCharacterAccountSightings: jest.fn() }))
jest.mock('../../../storage/mvp-grades', () => ({ getMvpGradeHistories: jest.fn() }))

import { getTrackedCharacterOcids } from '../../../storage/character-selection'
import { getCharacterAccountSightings } from '../../../storage/character-accounts'
import { getMvpGradeHistories } from '../../../storage/mvp-grades'
import { needsMvpOnboarding } from '../onboarding'

const m = (fn: unknown) => fn as jest.Mock

beforeEach(() => {
  m(getTrackedCharacterOcids).mockResolvedValue(['a1', 'b1'])
  m(getCharacterAccountSightings).mockResolvedValue([
    { ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
    { ocid: 'b1', name: '비', accountId: 'B', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
  ])
})

describe('needsMvpOnboarding', () => {
  it('추적 캐릭터가 속한 ID 가운데 등급 이력이 없는 것이 있으면 묻는다', async () => {
    m(getMvpGradeHistories).mockResolvedValue(new Map([['A', [{ startDate: '2026-09-17', grade: 'gold' }]]]))

    await expect(needsMvpOnboarding()).resolves.toBe(true)
  })

  it('다 있으면 안 묻는다. 캐시를 지운 뒤 다시 온보딩하는 사용자다', async () => {
    m(getMvpGradeHistories).mockResolvedValue(
      new Map([
        ['A', [{ startDate: '2026-09-17', grade: 'gold' }]],
        ['B', [{ startDate: '2026-09-17', grade: 'red' }]],
      ]),
    )

    await expect(needsMvpOnboarding()).resolves.toBe(false)
  })
})
