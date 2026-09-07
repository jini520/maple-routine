import { installFakePreferences } from './fake-preferences'
import { getNotices, mergeNotices } from '../notices'
import type { Notice } from '../../types/notice'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('notices')
})

function notice(id: string, publishedAt: string, body = '본문'): Notice {
  return { id, title: `공지 ${id}`, body, publishedAt }
}

describe('공지 저장', () => {
  it('저장된 것이 없으면 빈 배열', async () => {
    await expect(getNotices()).resolves.toEqual([])
  })

  it('넣은 것을 읽는다', async () => {
    await mergeNotices([notice('a', '2026-09-01T00:00:00Z')])

    await expect(getNotices()).resolves.toEqual([notice('a', '2026-09-01T00:00:00Z')])
  })

  // 최근 것이 위다. 목록이 그대로 그린다.
  it('최근 발행순으로 정렬한다', async () => {
    await mergeNotices([
      notice('old', '2026-09-01T00:00:00Z'),
      notice('new', '2026-09-05T00:00:00Z'),
    ])

    const ids = (await getNotices()).map((n) => n.id)
    expect(ids).toEqual(['new', 'old'])
  })

  // 같은 공지가 푸시로도 오고 서버 조회로도 온다. 나중에 온 쪽이 이긴다.
  it('같은 id 는 나중 것이 덮는다', async () => {
    await mergeNotices([notice('a', '2026-09-01T00:00:00Z', '잘린 본문')])
    await mergeNotices([notice('a', '2026-09-01T00:00:00Z', '온전한 본문')])

    const all = await getNotices()
    expect(all).toHaveLength(1)
    expect(all[0].body).toBe('온전한 본문')
  })

  it('50건을 넘으면 오래된 것부터 자른다', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      notice(`n${i}`, `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
    )

    await mergeNotices(many)

    const all = await getNotices()
    expect(all).toHaveLength(50)
    // 가장 최근 것이 남고 가장 오래된 것이 잘린다.
    expect(all[0].id).toBe('n59')
    expect(all.map((n) => n.id)).not.toContain('n0')
  })

  // 저장된 값이 깨져 있으면 화면이 못 서는 것보다 빈 목록이 낫다.
  it('깨진 JSON 은 빈 배열로 읽는다', async () => {
    await prefs.set('notices', '{{{')

    await expect(getNotices()).resolves.toEqual([])
  })

  it('배열이 아닌 값도 빈 배열로 읽는다', async () => {
    await prefs.set('notices', '{"id":"a"}')

    await expect(getNotices()).resolves.toEqual([])
  })
})
