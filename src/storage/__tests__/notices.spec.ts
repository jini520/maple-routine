import { installFakePreferences } from './fake-preferences'
import { getNotices, removeNotice, replaceNotices } from '../notices'
import type { Notice, NoticeKind } from '../../types/notice'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('notices')
})

function notice(id: string, publishedAt: string, kind: NoticeKind = 'app', body = '본문'): Notice {
  return { id, kind, title: `공지 ${id}`, body, publishedAt }
}

describe('공지 사본', () => {
  it('저장된 것이 없으면 빈 배열', async () => {
    await expect(getNotices()).resolves.toEqual([])
  })

  it('넣은 것을 읽는다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z')])

    await expect(getNotices()).resolves.toEqual([notice('a', '2026-09-01T00:00:00Z')])
  })

  it('최근 발행순으로 정렬한다', async () => {
    await replaceNotices('app', [
      notice('old', '2026-09-01T00:00:00Z'),
      notice('new', '2026-09-05T00:00:00Z'),
    ])

    expect((await getNotices()).map((n) => n.id)).toEqual(['new', 'old'])
  })

  // 서버에서 지운 공지가 앱에 남던 자리. 응답에 없는 id 는 사본에서도 없어야 한다.
  it('그 분류의 사본을 응답으로 통째로 바꾼다', async () => {
    await replaceNotices('app', [
      notice('a', '2026-09-01T00:00:00Z'),
      notice('b', '2026-09-02T00:00:00Z'),
      notice('c', '2026-09-03T00:00:00Z'),
    ])

    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z'), notice('c', '2026-09-03T00:00:00Z')])

    expect((await getNotices()).map((n) => n.id)).toEqual(['c', 'a'])
  })

  it('같은 id 는 새 응답의 내용으로 선다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z', 'app', '옛 본문')])
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z', 'app', '고친 본문')])

    const all = await getNotices()
    expect(all).toHaveLength(1)
    expect(all[0].body).toBe('고친 본문')
  })

  // 서버 공지를 전부 지우면 앱에서도 전부 사라진다.
  it('빈 응답은 그 분류의 사본을 비운다', async () => {
    await replaceNotices('game', [notice('game-1', '2026-09-01T00:00:00Z', 'game')])

    await replaceNotices('game', [])

    await expect(getNotices()).resolves.toEqual([])
  })

  // 앱 공지 목록을 연 뒤 오프라인에서 게임 공지 목록을 열어도 그 목록이 서야 한다.
  it('다른 분류의 사본은 건드리지 않는다', async () => {
    await replaceNotices('game', [notice('game-1', '2026-09-02T00:00:00Z', 'game')])

    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z')])
    await replaceNotices('app', [])

    expect((await getNotices()).map((n) => n.id)).toEqual(['game-1'])
  })

  // 한 분류를 묻는 응답에 다른 분류가 섞이면 그 항목은 계약 위반이다. 넣으면 다른 분류의 사본이
  // 이 조회로 바뀌고, 그 분류의 다음 조회가 올 때까지 남는다.
  it('다른 분류의 항목은 넣지 않는다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z'), notice('game-1', '2026-09-02T00:00:00Z', 'game')])

    expect((await getNotices()).map((n) => n.id)).toEqual(['a'])
  })

  // 옛 코드는 푸시와 서버를 합쳐 한 칸에 쌓았다. 그 값은 분류의 조회가 처음 성공할 때 바뀐다.
  it('옛 코드가 쌓은 값도 그 분류의 조회가 바꾼다', async () => {
    await prefs.set(
      'notices',
      JSON.stringify([
        { id: '푸시로만-온-것', title: '옛 공지', body: '', publishedAt: '2026-09-03T00:00:00Z' },
        notice('game-1', '2026-09-02T00:00:00Z', 'game'),
      ]),
    )

    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z')])

    expect((await getNotices()).map((n) => n.id)).toEqual(['game-1', 'a'])
  })

  // 상세 조회가 404 를 받은 공지.
  it('id 하나를 뺀다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z'), notice('b', '2026-09-02T00:00:00Z')])

    await removeNotice('b')

    expect((await getNotices()).map((n) => n.id)).toEqual(['a'])
  })

  it('없는 id 를 빼도 사본은 그대로다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z')])

    await removeNotice('없다')

    expect((await getNotices()).map((n) => n.id)).toEqual(['a'])
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
