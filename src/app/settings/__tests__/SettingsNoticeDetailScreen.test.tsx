// 이 화면이 지키는 것.
//
// ① 본문을 파라미터가 아니라 **저장소**에서 읽는다. 알림 탭이 연 경로와 목록이 연 경로가 같은
//    것을 그려야 해서다. 그래서 서버가 죽어도 열린다.
// ② 못 찾는 경우가 정상 경로다. 50건 상한에 잘렸거나 다른 기기에서 온 알림일 수 있다.
// ③ 찾는 중과 없음을 가른다. 합치면 여는 순간 못 찾았다는 문구가 한 프레임 스친다.
import { waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { fetchNotice } from '../../../server/notices'
import { getNotices } from '../../../storage/notices'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticeDetailScreen } from '../SettingsNoticeDetailScreen'
import type { Notice } from '../../../types/notice'

jest.mock('../../../storage/notices', () => ({
  __esModule: true,
  getNotices: jest.fn(),
  mergeNotices: jest.fn(async () => {}),
}))
jest.mock('../../../server/notices', () => ({ __esModule: true, fetchNotice: jest.fn(async () => null) }))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const notices = jest.mocked(getNotices)
const remote = jest.mocked(fetchNotice)

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
  remote.mockResolvedValue(null)
  jest.mocked(useSettingsNavigation).mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() } as never)
})

describe('본문', () => {
  it('저장소에서 찾아 그린다', async () => {
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

describe('서버 보강', () => {
  // 푸시는 4KB 상한 때문에 본문이 잘려 올 수 있다. 조회가 그 자리를 덮는다.
  it('서버가 준 본문이 로컬 것을 덮는다', async () => {
    notices.mockResolvedValue([{ ...점검, body: '잘린 본문…' }])
    remote.mockResolvedValue({ ...점검, body: '온전한 본문 전부' })

    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    await waitFor(() => expect(view.getByTestId('notice-body')).toHaveTextContent('온전한 본문 전부'))
  })

  // 알림을 안 탭해 기기에 없는 공지를 목록에서 열 수 있어야 한다.
  it('로컬에 없어도 서버에서 가져온다', async () => {
    notices.mockResolvedValue([])
    remote.mockResolvedValue(점검)

    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    await waitFor(() => expect(view.getByTestId('notice-title')).toHaveTextContent('점검 안내'))
  })

  it('조회가 실패해도 로컬 것을 그린다', async () => {
    remote.mockRejectedValue(new Error('offline'))

    const view = await renderOverlay(
      <SettingsNoticeDetailScreen route={{ params: { noticeId: 'a' } }} />,
    )

    expect(view.getByTestId('notice-title')).toHaveTextContent('점검 안내')
  })
})

// 이벤트·캐시샵은 푸시가 본문을 0자로 실어 온다(본문이 이미지 한 장이라 평문이 없다).
// 탭해서 들어온 직후에는 그릴 것이 정말 없고, 그 빈칸을 사용자는 고장으로 읽는다.
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
    remote.mockResolvedValue(null)

    const view = await renderOverlay(<SettingsNoticeDetailScreen route={{ params: { noticeId: 'event-1374' } }} />)

    await waitFor(() => {
      expect(view.getByTestId('notice-body-pending').props.children).toBe('본문을 받지 못했어요')
    })
  })

  it('서버가 블록을 주면 그것을 그린다', async () => {
    notices.mockResolvedValue([이미지공지])
    remote.mockResolvedValue({
      ...이미지공지,
      blocks: [{ type: 'image', src: 'https://lwi.nexon.com/a.png' }],
    })

    const view = await renderOverlay(<SettingsNoticeDetailScreen route={{ params: { noticeId: 'event-1374' } }} />)

    await waitFor(() => {
      expect(view.getByTestId('notice-image')).toBeTruthy()
    })
    expect(view.queryByTestId('notice-body-pending')).toBeNull()
  })
})
