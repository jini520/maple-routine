jest.mock('../../../server/notices', () => ({
  __esModule: true,
  fetchNotices: jest.fn(),
}))

import { fetchNotices } from '../../../server/notices'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getDismissedNoticeIds } from '../../../storage/notice-banner'
import { mergeNotices } from '../../../storage/notices'
import type { Notice } from '../../../types/notice'
import { useNoticeBannerStore } from '../banner-store'

const fetchAll = jest.mocked(fetchNotices)

function notice(id: string, publishedAt: string, title = `공지 ${id}`): Notice {
  return { id, title, body: '본문', publishedAt }
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
    await mergeNotices([notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')])

    await useNoticeBannerStore.getState().load()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('new')
  })

  // 앞에 있을 때 푸시가 오면 이 문을 다시 두드린다. 그 경로에 네트워크가 붙으면 알림 한 건이
  // 요청 한 건이 된다.
  it('서버를 안 부른다', async () => {
    await mergeNotices([notice('a', '2026-09-01T00:00:00Z')])

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
  it('서버에서 받아 기기에 합친 뒤 세운다', async () => {
    fetchAll.mockResolvedValue([notice('remote', '2026-09-05T00:00:00Z')])

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('remote')
  })

  it('같은 id 는 서버가 이긴다', async () => {
    await mergeNotices([notice('a', '2026-09-01T00:00:00Z', '잘린 제목')])
    fetchAll.mockResolvedValue([notice('a', '2026-09-01T00:00:00Z', '온전한 제목')])

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.title).toBe('온전한 제목')
  })

  it('서버가 실패해도 기기에 있는 것을 세운다', async () => {
    await mergeNotices([notice('local', '2026-09-01T00:00:00Z')])
    fetchAll.mockRejectedValue(new Error('망 끊김'))

    await useNoticeBannerStore.getState().refresh()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('local')
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
    await mergeNotices([notice('a', '2026-09-01T00:00:00Z')])
    await useNoticeBannerStore.getState().load()

    await useNoticeBannerStore.getState().dismiss()

    expect(useNoticeBannerStore.getState().notice).toBeNull()
    await expect(getDismissedNoticeIds()).resolves.toEqual(['a'])
  })

  // 후보가 최신 하나뿐이라 닫으면 배너가 없다. 옛 공지가 그 자리에 안 올라온다.
  it('닫으면 옛 공지가 그 자리에 안 올라온다', async () => {
    await mergeNotices([notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')])
    await useNoticeBannerStore.getState().load()

    await useNoticeBannerStore.getState().dismiss()

    expect(useNoticeBannerStore.getState().notice).toBeNull()
  })

  it('닫은 뒤 더 최근 공지가 도착하면 다시 선다', async () => {
    await mergeNotices([notice('new', '2026-09-05T00:00:00Z')])
    await useNoticeBannerStore.getState().load()
    await useNoticeBannerStore.getState().dismiss()

    await mergeNotices([notice('newer', '2026-09-09T00:00:00Z')])
    await useNoticeBannerStore.getState().load()

    expect(useNoticeBannerStore.getState().notice?.id).toBe('newer')
  })

  it('세워진 배너가 없으면 아무것도 안 적는다', async () => {
    await useNoticeBannerStore.getState().dismiss()

    await expect(getDismissedNoticeIds()).resolves.toEqual([])
  })
})
