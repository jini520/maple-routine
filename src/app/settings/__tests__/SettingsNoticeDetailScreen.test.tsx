// 이 화면이 지키는 것.
//
// ① 본문을 파라미터가 아니라 **저장소**에서 읽는다. 알림 탭이 연 경로와 목록이 연 경로가 같은
//    것을 그려야 해서다. 그래서 서버가 죽어도 열린다.
// ② 못 찾는 경우가 정상 경로다. 50건 상한에 잘렸거나 다른 기기에서 온 알림일 수 있다.
// ③ 찾는 중과 없음을 가른다. 합치면 여는 순간 못 찾았다는 문구가 한 프레임 스친다.
import { renderOverlay } from '../../../components/__tests__/render-atom'
import { getNotices } from '../../../storage/notices'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticeDetailScreen } from '../SettingsNoticeDetailScreen'
import type { Notice } from '../../../types/notice'

jest.mock('../../../storage/notices', () => ({ __esModule: true, getNotices: jest.fn() }))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const notices = jest.mocked(getNotices)

const 점검: Notice = {
  id: 'a',
  title: '점검 안내',
  body: '9월 8일 02시부터 06시까지 점검합니다.',
  publishedAt: '2026-09-07T12:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  notices.mockResolvedValue([점검])
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
