// 서버가 보낸 것을 우리 타입으로 좁히는 자리다. 여기가 느슨하면 화면이 빈 칸을 그린다.
//
// FCM 은 data 값을 전부 문자열로만 싣는다. 그래서 숫자나 객체가 오는 경우는 없고, 대신
// **빠져 있는 경우**가 실제로 온다(서버가 필드를 안 넣거나 이름을 바꿨을 때).
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getNotices } from '../../../storage/notices'
import { parseNotice, receiveNotice } from '../receive'

const 온전한 = {
  noticeId: 'a',
  title: '점검 안내',
  body: '9월 8일 02시부터 점검합니다.',
  publishedAt: '2026-09-07T12:00:00Z',
}

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('notices')
})

describe('페이로드 읽기', () => {
  it('분류를 실어 오면 그대로 읽는다', () => {
    expect(parseNotice({ ...온전한, kind: 'game' })?.kind).toBe('game')
  })

  // 서버가 새 분류를 늘렸는데 이 앱이 그것을 모르면 화면에 그릴 자리가 없다.
  it('모르는 분류는 앱 공지로 읽는다', () => {
    expect(parseNotice({ ...온전한, kind: '뭔가새로운것' })?.kind).toBe('app')
  })

  it('네 필드가 다 있으면 공지가 된다', () => {
    expect(parseNotice(온전한)).toEqual({
      id: 'a',
      // 분류가 없는 옛 푸시는 운영자 공지다. 그때는 그것밖에 없었다.
      kind: 'app',
      title: '점검 안내',
      body: '9월 8일 02시부터 점검합니다.',
      publishedAt: '2026-09-07T12:00:00Z',
    })
  })

  it('link 가 있으면 함께 담는다', () => {
    expect(parseNotice({ ...온전한, link: 'https://example.com' })?.link).toBe(
      'https://example.com',
    )
  })

  // 우리가 안 쓰는 키가 섞여 와도 통과해야 한다. 서버가 필드를 더할 수 있다.
  it('모르는 키는 버리고 통과시킨다', () => {
    expect(parseNotice({ ...온전한, 미래필드: '값' })).not.toBeNull()
  })

  it.each(['noticeId', 'title', 'body', 'publishedAt'])('%s 가 없으면 null', (missing) => {
    const broken: Record<string, string> = { ...온전한 }
    delete broken[missing]

    expect(parseNotice(broken)).toBeNull()
  })

  it('빈 문자열 id 는 안 받는다', () => {
    expect(parseNotice({ ...온전한, noticeId: '' })).toBeNull()
  })

  // 공지가 아닌 푸시가 올 수 있다. 그때 조용히 지나가야지 던지면 안 된다.
  it('빈 페이로드는 null', () => {
    expect(parseNotice({})).toBeNull()
  })
})

describe('받아서 쌓기', () => {
  it('온전한 것은 저장된다', async () => {
    await receiveNotice(온전한)

    const all = await getNotices()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('a')
  })

  it('못 읽는 것은 저장하지 않는다', async () => {
    await receiveNotice({ 아무거나: '값' })

    await expect(getNotices()).resolves.toEqual([])
  })

  // 같은 공지가 포그라운드 수신과 탭 양쪽으로 올 수 있다. 두 번 쌓이면 안 된다.
  it('같은 것을 두 번 받아도 한 건이다', async () => {
    await receiveNotice(온전한)
    await receiveNotice(온전한)

    await expect(getNotices()).resolves.toHaveLength(1)
  })
})
