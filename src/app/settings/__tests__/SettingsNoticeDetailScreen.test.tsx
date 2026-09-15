// 이 화면이 지키는 것.
//
// ① 본문을 파라미터가 아니라 **서버와 사본**에서 읽는다. 알림 탭이 연 경로와 목록이 연 경로가 같은
//    것을 그려야 해서다. 서버가 죽으면 사본이 열린다.
// ② 못 찾는 경우가 정상 경로다. 20건 밖이거나 서버에서 지운 공지일 수 있다.
// ③ 찾는 중과 없음을 가른다. 합치면 여는 순간 못 찾았다는 문구가 한 프레임 스친다.
import { waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { forgetNotice } from '../../../features/notice/notice-copy'
import { fetchNoticeDetail } from '../../../features/notice/notice-feed'
import { getNotices } from '../../../storage/notices'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticeDetailScreen } from '../SettingsNoticeDetailScreen'
import type { Notice } from '../../../types/notice'

jest.mock('../../../storage/notices', () => ({ __esModule: true, getNotices: jest.fn() }))
jest.mock('../../../features/notice/notice-copy', () => ({
  __esModule: true,
  forgetNotice: jest.fn(async () => {}),
}))
// 앱 공지는 서버, 넥슨 공지는 넥슨 상세다. 어디서 받는지는 받는 쪽 테스트가 본다.
jest.mock('../../../features/notice/notice-feed', () => ({
  __esModule: true,
  fetchNoticeDetail: jest.fn(async () => ({ status: 'failed' })),
}))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const notices = jest.mocked(getNotices)
const remote = jest.mocked(fetchNoticeDetail)
const forget = jest.mocked(forgetNotice)

const 점검: Notice = {
  id: 'a',
  kind: 'app',
  title: '점검 안내',
  body: '9월 8일 02시부터 06시까지 점검합니다.',
  publishedAt: '2026-09-07T12:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  notices.mockResolvedValue([점검])
  remote.mockResolvedValue({ status: 'failed' })
  jest.mocked(useSettingsNavigation).mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() } as never)
})

describe('본문', () => {
  it('사본에서 찾아 그린다', async () => {
    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    expect(view.getByTestId('notice-title')).toHaveTextContent('점검 안내')
    expect(view.getByTestId('notice-body')).toHaveTextContent('9월 8일 02시부터 06시까지 점검합니다.')
  })

  it('없는 id 면 못 찾았다고 말한다', async () => {
    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: '없다' } }} />,
    )

    expect(view.getByText('공지를 찾을 수 없습니다')).toBeTruthy()
  })

  it('파라미터가 아예 없어도 안 깨진다', async () => {
    const view = await renderOverlay(<SettingsNoticeDetailScreen />)

    expect(view.getByText('공지를 찾을 수 없습니다')).toBeTruthy()
  })
})

describe('링크', () => {
  it('없으면 자세히 보기를 안 그린다', async () => {
    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    expect(view.queryByLabelText('자세히 보기')).toBeNull()
  })

  it('있으면 그린다', async () => {
    notices.mockResolvedValue([{ ...점검, link: 'https://example.com' }])
    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    expect(view.getByLabelText('자세히 보기')).toBeTruthy()
  })
})

describe('서버 조회', () => {
  it('서버가 준 본문이 사본의 것을 덮는다', async () => {
    notices.mockResolvedValue([{ ...점검, body: '목록의 요약' }])
    remote.mockResolvedValue({ status: 'found', notice: { ...점검, body: '온전한 본문 전부' } })

    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    await waitFor(() => expect(view.getByTestId('notice-body')).toHaveTextContent('온전한 본문 전부'))
  })

  // 20건 밖 공지나 방금 온 알림은 사본에 없다.
  it('사본에 없어도 서버에서 가져온다', async () => {
    notices.mockResolvedValue([])
    remote.mockResolvedValue({ status: 'found', notice: 점검 })

    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    await waitFor(() => expect(view.getByTestId('notice-title')).toHaveTextContent('점검 안내'))
  })

  it('조회가 실패하면 사본을 그린다', async () => {
    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    await waitFor(() => expect(remote).toHaveBeenCalled())
    expect(view.getByTestId('notice-title')).toHaveTextContent('점검 안내')
    expect(forget).not.toHaveBeenCalled()
  })

  it('조회가 던져도 사본을 그린다', async () => {
    remote.mockRejectedValue(new Error('offline'))

    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    expect(view.getByTestId('notice-title')).toHaveTextContent('점검 안내')
  })

  // 서버가 그 공지를 없다고 답했다. 사본에 남아 있어도 그리지 않는다.
  it('404 면 사본에 있어도 못 찾았다고 말하고 사본과 닫은 기록에서 뺀다', async () => {
    remote.mockResolvedValue({ status: 'missing' })

    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    await waitFor(() => expect(view.getByText('공지를 찾을 수 없습니다')).toBeTruthy())
    expect(forget).toHaveBeenCalledWith('a')
  })
})

// 이벤트·캐시샵은 목록 사본의 본문이 0자다(본문이 이미지 한 장이라 평문이 없다).
// 서버가 답하기 전이나 오프라인에서는 그릴 것이 정말 없고, 그 빈칸을 사용자는 고장으로 읽는다.
describe('본문이 빈 공지', () => {
  const 이미지공지: Notice = {
    id: 'event-1374',
    kind: 'event',
    title: '스페셜 썬데이 메이플',
    body: '',
    publishedAt: '2026-09-06T00:00:00Z',
  }

  it('서버가 답하기 전에는 받는 중이라고 말한다', async () => {
    notices.mockResolvedValue([이미지공지])
    // 영영 안 끝나는 조회. 그 사이 화면이 무엇을 말하는지 본다.
    remote.mockReturnValue(new Promise(() => {}))

    const view = await renderOverlay(<SettingsNoticeDetailScreen route={{ params: { noticeId: 'event-1374' } }} />)

    await waitFor(() => {
      expect(view.getByTestId('notice-body-pending').props.children).toBe('본문을 받는 중이에요')
    })
  })

  it('서버가 못 주면 못 받았다고 말한다', async () => {
    notices.mockResolvedValue([이미지공지])
    remote.mockResolvedValue({ status: 'failed' })

    const view = await renderOverlay(<SettingsNoticeDetailScreen route={{ params: { noticeId: 'event-1374' } }} />)

    await waitFor(() => {
      expect(view.getByTestId('notice-body-pending').props.children).toBe('본문을 받지 못했어요')
    })
  })

  it('서버가 블록을 주면 그것을 그린다', async () => {
    notices.mockResolvedValue([이미지공지])
    remote.mockResolvedValue({
      status: 'found',
      notice: { ...이미지공지, blocks: [{ type: 'image', src: 'https://lwi.nexon.com/a.png' }] },
    })

    const view = await renderOverlay(<SettingsNoticeDetailScreen route={{ params: { noticeId: 'event-1374' } }} />)

    await waitFor(() => {
      expect(view.getByTestId('notice-image')).toBeTruthy()
    })
    expect(view.queryByTestId('notice-body-pending')).toBeNull()
  })
})
