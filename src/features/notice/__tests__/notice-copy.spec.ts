// 조회 결과를 사본과 닫은 기록에 옮기는 자리.
//
// 지키는 것은 둘이다. ① 닫은 기록은 **앱 공지 사본을 바꿀 때만** 정리한다. 게임 공지 응답에는 앱
// 공지 id 가 없어서 그 응답으로 정리하면 닫은 배너가 전부 되살아난다. ② 서버가 없다고 답한 공지는
// 사본과 닫은 기록 둘 다에서 빠진다.
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { dismissNotice, getDismissedNoticeIds } from '../../../storage/notice-banner'
import { getNotices, replaceNotices } from '../../../storage/notices'
import type { Notice, NoticeKind } from '../../../types/notice'
import { forgetNotice, saveNoticeResponse } from '../notice-copy'

function notice(id: string, kind: NoticeKind = 'app'): Notice {
  return { id, kind, title: `공지 ${id}`, body: '본문', publishedAt: '2026-09-01T00:00:00Z' }
}

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('notices')
  await prefs.remove('dismissedNotices')
})

describe('조회 결과 저장', () => {
  it('그 분류의 사본을 응답으로 바꾼다', async () => {
    await replaceNotices('app', [notice('a'), notice('b')])

    await saveNoticeResponse('app', [notice('a')])

    expect((await getNotices()).map((n) => n.id)).toEqual(['a'])
  })

  it('앱 공지 응답이면 닫은 기록에서 서버에 없는 id 를 뺀다', async () => {
    await dismissNotice('a')
    await dismissNotice('지워진-것')

    await saveNoticeResponse('app', [notice('a')])

    await expect(getDismissedNoticeIds()).resolves.toEqual(['a'])
  })

  it('다른 분류의 응답으로는 닫은 기록을 안 건드린다', async () => {
    await dismissNotice('a')

    await saveNoticeResponse('game', [notice('game-1', 'game')])

    await expect(getDismissedNoticeIds()).resolves.toEqual(['a'])
  })
})

describe('서버가 없다고 답한 공지', () => {
  it('사본과 닫은 기록에서 뺀다', async () => {
    await replaceNotices('app', [notice('a'), notice('b')])
    await dismissNotice('a')

    await forgetNotice('a')

    expect((await getNotices()).map((n) => n.id)).toEqual(['b'])
    await expect(getDismissedNoticeIds()).resolves.toEqual([])
  })
})
