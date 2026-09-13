import { installFakePreferences } from './fake-preferences'
import {
  dismissNotice,
  forgetDismissedNotice,
  getDismissedNoticeIds,
  keepDismissedNotices,
} from '../notice-banner'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dismissedNotices')
})

describe('배너에서 닫은 공지', () => {
  it('닫은 것이 없으면 빈 배열', async () => {
    await expect(getDismissedNoticeIds()).resolves.toEqual([])
  })

  it('닫으면 남는다', async () => {
    await dismissNotice('a')

    await expect(getDismissedNoticeIds()).resolves.toEqual(['a'])
  })

  // 같은 배너를 두 번 닫을 수는 없지만, 저장이 늦고 사용자가 빨리 누르면 두 번 들어올 수 있다.
  it('같은 id 를 두 번 닫아도 한 칸만 쓴다', async () => {
    await dismissNotice('a')
    await dismissNotice('a')

    await expect(getDismissedNoticeIds()).resolves.toEqual(['a'])
  })

  // 조회가 한 번도 성공하지 못한 기기에서도 이 값이 끝없이 자라지 않게 하는 바닥이다.
  it('50건을 넘으면 오래 전에 닫은 것부터 자른다', async () => {
    for (let i = 0; i < 60; i += 1) await dismissNotice(`n${i}`)

    const ids = await getDismissedNoticeIds()
    expect(ids).toHaveLength(50)
    expect(ids).toContain('n59')
    expect(ids).not.toContain('n0')
  })

  // 서버에서 지운 공지의 id 가 기록에 계속 남지 않게 한다.
  it('서버 목록에 없는 id 를 뺀다', async () => {
    await dismissNotice('a')
    await dismissNotice('b')
    await dismissNotice('c')

    await keepDismissedNotices(['c', 'a', 'z'])

    await expect(getDismissedNoticeIds()).resolves.toEqual(['a', 'c'])
  })

  // 상세 조회가 404 를 받은 공지.
  it('id 하나를 뺀다', async () => {
    await dismissNotice('a')
    await dismissNotice('b')

    await forgetDismissedNotice('a')

    await expect(getDismissedNoticeIds()).resolves.toEqual(['b'])
  })

  // 깨진 값에 기대 배너를 영영 안 세우느니, 한 번 더 보여 주는 편이 낫다.
  it('깨진 값이면 빈 배열', async () => {
    await prefs.set('dismissedNotices', '{정상적인 JSON 이 아니다')

    await expect(getDismissedNoticeIds()).resolves.toEqual([])
  })

  it('문자열이 아닌 항목은 버린다', async () => {
    await prefs.set('dismissedNotices', JSON.stringify(['a', 3, null, 'b']))

    await expect(getDismissedNoticeIds()).resolves.toEqual(['a', 'b'])
  })
})
