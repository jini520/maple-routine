// 이 화면이 지키는 것.
//
// ① 스위치가 설정 본화면이 아니라 여기 있다. 목록과 함께 서야 사용자가 무엇을 켜는지 안다.
// ② 목록은 사본이나 응답을 받은 순서 그대로 그린다. 화면이 다시 정렬하지 않는다.
// ③ 행을 누르면 상세로 밀되 **`noticeId` 만** 넘긴다. 본문을 넘기면 알림에서 온 경로와
//    목록에서 온 경로가 서로 다른 내용을 그릴 수 있다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { saveNoticeResponse } from '../../../features/notice/notice-copy'
import { fetchNotices } from '../../../server/notices'
import { getNotices } from '../../../storage/notices'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticesScreen } from '../SettingsNoticesScreen'
import type { Notice } from '../../../types/notice'

jest.mock('../../../storage/notices', () => ({ __esModule: true, getNotices: jest.fn() }))
jest.mock('../../../features/notice/notice-copy', () => ({
  __esModule: true,
  saveNoticeResponse: jest.fn(async () => {}),
}))
jest.mock('../../../server/notices', () => ({ __esModule: true, fetchNotices: jest.fn(async () => null) }))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const notices = jest.mocked(getNotices)
const remote = jest.mocked(fetchNotices)
const save = jest.mocked(saveNoticeResponse)
const navigate = jest.fn()
const goBack = jest.fn()

function notice(id: string, title: string, publishedAt: string): Notice {
  return { id, kind: 'app', title, body: `${id} 본문`, publishedAt }
}

beforeEach(() => {
  jest.clearAllMocks()
  notices.mockResolvedValue([])
  remote.mockResolvedValue(null)
  save.mockResolvedValue(undefined)
  jest.mocked(useSettingsNavigation).mockReturnValue({ navigate, goBack } as never)
})


describe('목록', () => {
  // 제목은 부르는 쪽이 준다. 소식 카드의 행 이름이 그대로 화면 제목이자 빈 상태 문구가 된다.
  it('받은 것이 없으면 그 분류 이름으로 빈 상태를 말한다', async () => {
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['cashshop'], title: '캐시샵' } }} />,
    )

    expect(view.getByText('아직 받은 캐시샵이 없습니다')).toBeTruthy()
  })

  it('분류를 안 주면 소식 전부다', async () => {
    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getByText('아직 받은 소식이 없습니다')).toBeTruthy()
  })

  // 한 목록에 다 담으면 점검 안내와 캐시아이템이 섞인다.
  it('준 분류만 그린다', async () => {
    notices.mockResolvedValue([
      { id: 'game-1', kind: 'game', title: '점검 안내', body: '본문', publishedAt: '2026-09-09T00:00:00Z' },
      { id: 'cashshop-1', kind: 'cashshop', title: '캐시 업데이트', body: '본문', publishedAt: '2026-09-08T00:00:00Z' },
    ])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지사항' } }} />,
    )

    await waitFor(() => expect(view.getByText('점검 안내')).toBeTruthy())
    expect(view.queryByText('캐시 업데이트')).toBeNull()
  })

  it('저장소가 준 순서를 그대로 그린다', async () => {
    notices.mockResolvedValue([
      notice('b', '나중 공지', '2026-09-05T00:00:00Z'),
      notice('a', '먼저 공지', '2026-09-01T00:00:00Z'),
    ])
    const view = await renderOverlay(<SettingsNoticesScreen />)

    const rows = view.getAllByTestId('notice-row')
    expect(rows).toHaveLength(2)
    expect(view.getByText('나중 공지')).toBeTruthy()
  })

  it('누르면 noticeId 만 넘겨 상세로 민다', async () => {
    notices.mockResolvedValue([notice('a', '점검 안내', '2026-09-01T00:00:00Z')])
    const view = await renderOverlay(<SettingsNoticesScreen />)

    await act(async () => {
      fireEvent.press(view.getByTestId('notice-row'))
    })

    expect(navigate).toHaveBeenCalledWith('SettingsNoticeDetail', { noticeId: 'a' })
  })
})


describe('서버 조회', () => {
  it('그 분류만 20건 묻는다', async () => {
    await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '게임 공지사항' } }} />)

    expect(remote).toHaveBeenCalledWith(20, ['game'])
  })

  // 서버에서 지운 공지가 목록에 남던 자리.
  it('성공하면 그 분류의 사본을 응답으로 바꾸고 응답을 그린다', async () => {
    const 남은것 = notice('kept', '남은 공지', '2026-09-01T00:00:00Z')
    notices.mockResolvedValue([notice('deleted', '지운 공지', '2026-09-05T00:00:00Z'), 남은것])
    remote.mockResolvedValue([남은것])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await waitFor(() => expect(view.queryByText('지운 공지')).toBeNull())
    expect(view.getByText('남은 공지')).toBeTruthy()
    expect(save).toHaveBeenCalledWith('app', [남은것])
  })

  // 서버 공지를 전부 지우면 앱에서도 전부 사라진다.
  it('빈 응답이면 빈 상태를 그리고 사본도 비운다', async () => {
    notices.mockResolvedValue([notice('deleted', '지운 공지', '2026-09-05T00:00:00Z')])
    remote.mockResolvedValue([])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await waitFor(() => expect(view.getByText('아직 받은 앱 공지사항이 없습니다')).toBeTruthy())
    expect(save).toHaveBeenCalledWith('app', [])
  })

  // 조회 실패가 화면 전체의 실패가 되면 안 된다. 사본은 그대로 보여야 한다.
  it('조회가 실패하면 사본을 그리고 사본을 안 건드린다', async () => {
    notices.mockResolvedValue([notice('local-1', '기기에 있던 공지', '2026-09-01T00:00:00Z')])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await waitFor(() => expect(remote).toHaveBeenCalled())
    expect(view.getByText('기기에 있던 공지')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })

  it('조회가 던져도 사본을 그린다', async () => {
    remote.mockRejectedValue(new Error('offline'))
    notices.mockResolvedValue([notice('local-1', '기기에 있던 공지', '2026-09-01T00:00:00Z')])

    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getByText('기기에 있던 공지')).toBeTruthy()
  })

  // 분류 없는 20건은 어느 한 분류의 최근 20건이 아니다. 그것으로 사본을 바꾸면 밀린 공지가 지워진다.
  it('분류 없이 물은 응답으로는 사본을 안 바꾼다', async () => {
    remote.mockResolvedValue([notice('server-1', '서버에서 온 공지', '2026-09-09T00:00:00Z')])

    const view = await renderOverlay(<SettingsNoticesScreen />)

    await waitFor(() => expect(view.getByText('서버에서 온 공지')).toBeTruthy())
    expect(save).not.toHaveBeenCalled()
  })
})
