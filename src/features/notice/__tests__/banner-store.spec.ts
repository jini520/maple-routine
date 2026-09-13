jest.mock('../../../server/notices', () => ({
  __esModule: true,
  fetchNotices: jest.fn(),
}))

import { fetchNotices } from '../../../server/notices'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { dismissNotice, getDismissedNoticeIds } from '../../../storage/notice-banner'
import { getNotices, replaceNotices } from '../../../storage/notices'
import type { Notice } from '../../../types/notice'
import { useNoticeBannerStore } from '../banner-store'

const fetchAll = jest.mocked(fetchNotices)

function notice(id: string, publishedAt: string, title = `공지 ${id}`): Notice {
  return { id, kind: 'app', title, body: '본문', publishedAt }
}

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('notices')
  await prefs.remove('dismissedNotices')
  jest.clearAllMocks()
  fetchAll.mockResolvedValue([])
  useNoticeBannerStore.setState({ notice: null })
})

describe('load', () => {
  it('쌓인 것이 없으면 배너가 안 선다', async () => {
    await useNoticeBannerStore.getState().load()

    expect(useNoticeBannerStore.getState().notice).toBeNull()
  })

  it('가장 최근 공지를 세운다', async () => {
    await replaceNotices('app', [notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')])

    await useNoticeBannerStore.getState().load()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('new')
  })

  // 마운트와 포커스가 부르는 문이다. 화면에 들어올 때마다 요청이 나가면 안 된다.
  it('서버를 안 부른다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z')])

    await useNoticeBannerStore.getState().load()

    expect(fetchAll).not.toHaveBeenCalled()
  })

  it('저장소가 던져도 배너만 안 서고 끝난다', async () => {
    const prefs = installFakePreferences()
    prefs.get.mockRejectedValue(new Error('저장소 고장'))

    await expect(useNoticeBannerStore.getState().load()).resolves.toBeUndefined()
    expect(useNoticeBannerStore.getState().notice).toBeNull()
  })
})

describe('refresh', () => {
  // 배경에서 도착만 하고 안 탭한 공지가 여기서 들어온다.
  it('서버에서 받은 것을 세운다', async () => {
    fetchAll.mockResolvedValue([notice('remote', '2026-09-05T00:00:00Z')])

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('remote')
  })

  // 분류 없이 20건을 받으면 넥슨 공지가 몰린 날 앱 공지가 그 밖으로 밀려 배너가 사라진다.
  it('앱 공지만 20건 묻는다', async () => {
    await useNoticeBannerStore.getState().refresh()

    expect(fetchAll).toHaveBeenCalledWith(20, ['app'])
  })

  it('같은 id 는 서버 것으로 선다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z', '옛 제목')])
    fetchAll.mockResolvedValue([notice('a', '2026-09-01T00:00:00Z', '고친 제목')])

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.title).toBe('고친 제목')
  })

  // 서버에서 지운 공지가 배너에 남던 자리.
  it('서버에서 지운 공지는 배너에서도 내려간다', async () => {
    await replaceNotices('app', [
      notice('old', '2026-09-01T00:00:00Z'),
      notice('deleted', '2026-09-05T00:00:00Z'),
    ])
    await useNoticeBannerStore.getState().load()
    fetchAll.mockResolvedValue([notice('old', '2026-09-01T00:00:00Z')])

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('old')
    expect((await getNotices()).map((n) => n.id)).toEqual(['old'])
  })

  it('서버가 빈손이면 배너가 없다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z')])
    fetchAll.mockResolvedValue([])

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice).toBeNull()
  })

  it('조회가 실패하면 사본에 있는 것을 세운다', async () => {
    await replaceNotices('app', [notice('local', '2026-09-01T00:00:00Z')])
    fetchAll.mockResolvedValue(null)

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('local')
    expect((await getNotices()).map((n) => n.id)).toEqual(['local'])
  })

  it('조회가 던져도 사본에 있는 것을 세운다', async () => {
    await replaceNotices('app', [notice('local', '2026-09-01T00:00:00Z')])
    fetchAll.mockRejectedValue(new Error('망 끊김'))

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('local')
  })

  it('서버 목록에 없는 공지는 닫은 기록에서 빠진다', async () => {
    await dismissNotice('deleted')
    await dismissNotice('a')
    fetchAll.mockResolvedValue([notice('a', '2026-09-01T00:00:00Z')])

    await useNoticeBannerStore.getState().refresh()

    await expect(getDismissedNoticeIds()).resolves.toEqual(['a'])
  })

  it('이미 닫은 공지는 서버가 다시 줘도 안 선다', async () => {
    fetchAll.mockResolvedValue([notice('a', '2026-09-01T00:00:00Z')])
    await useNoticeBannerStore.getState().refresh()
    await useNoticeBannerStore.getState().dismiss()

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice).toBeNull()
  })
})

describe('dismiss', () => {
  it('닫으면 배너가 내려가고 저장에 남는다', async () => {
    await replaceNotices('app', [notice('a', '2026-09-01T00:00:00Z')])
    await useNoticeBannerStore.getState().load()

    await useNoticeBannerStore.getState().dismiss()

    expect(useNoticeBannerStore.getState().notice).toBeNull()
    await expect(getDismissedNoticeIds()).resolves.toEqual(['a'])
  })

  // 후보가 최신 하나뿐이라 닫으면 배너가 없다. 옛 공지가 그 자리에 안 올라온다.
  it('닫으면 옛 공지가 그 자리에 안 올라온다', async () => {
    await replaceNotices('app', [notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')])
    await useNoticeBannerStore.getState().load()

    await useNoticeBannerStore.getState().dismiss()

    expect(useNoticeBannerStore.getState().notice).toBeNull()
  })

  it('닫은 뒤 더 최근 공지가 도착하면 다시 선다', async () => {
    await replaceNotices('app', [notice('new', '2026-09-05T00:00:00Z')])
    await useNoticeBannerStore.getState().load()
    await useNoticeBannerStore.getState().dismiss()

    await replaceNotices('app', [notice('new', '2026-09-05T00:00:00Z'), notice('newer', '2026-09-09T00:00:00Z')])
    await useNoticeBannerStore.getState().load()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('newer')
  })

  it('세워진 배너가 없으면 아무것도 안 적는다', async () => {
    await useNoticeBannerStore.getState().dismiss()

    await expect(getDismissedNoticeIds()).resolves.toEqual([])
  })
})
