// 임시 점검 화면. 이 도구가 하는 일은 둘이다.
//
// ① **출처를 갈라 본다.** 넥슨이 주는 것과 우리 서버가 든 것을 나란히 보면 «넥슨엔 있는데
//    서버에 없다»(폴러가 아직 안 돌았다)와 «양쪽 다 없다»(넥슨이 진짜 안 준다)가 갈린다.
// ② **0건과 조회 실패를 가른다.** 제품 화면은 둘 다 빈 화면으로 그린다.
//
// ⚠️ 임시다. `src/app/settings/debug/` 폴더째 지우는 것이 폐기 절차다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../../components/__tests__/render-atom'
import type { Notice } from '../../../../types/notice'
import { probeNexonDetail, probeNexonList } from '../nexon-probe'
import { probeDetail, probeList } from '../probe'
import { NoticeKindsScreen } from '../NoticeKindsScreen'

jest.mock('../probe', () => ({
  __esModule: true,
  probeList: jest.fn(),
  probeDetail: jest.fn(),
}))
jest.mock('../nexon-probe', () => ({
  __esModule: true,
  probeNexonList: jest.fn(),
  probeNexonDetail: jest.fn(),
  describeContents: (html: string) => `HTML ${html.length}자`,
}))
jest.mock('../../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}))

const nexonList = jest.mocked(probeNexonList)
const nexonDetail = jest.mocked(probeNexonDetail)
const serverList = jest.mocked(probeList)
const serverDetail = jest.mocked(probeDetail)

const 넥슨한건 = {
  notice_id: 149862,
  title: '9/10(목) 넥슨 정기점검 안내',
  url: 'https://maplestory.nexon.com/News/Notice/Notice/149862',
  date: '2026-09-09T16:24+09:00',
}

function notice(id: string, title: string): Notice {
  return { id, kind: 'game', title, body: '본문', publishedAt: '2026-09-09T07:24:00.000Z' }
}

beforeEach(() => {
  jest.clearAllMocks()
  nexonList.mockResolvedValue({
    path: '/maplestory/v1/notice',
    error: null,
    ms: 120,
    data: [넥슨한건],
  })
  nexonDetail.mockResolvedValue({
    path: '/maplestory/v1/notice/detail?notice_id=149862',
    error: null,
    ms: 90,
    data: { title: '점검', contents: '<p>본문</p>' },
  })
  serverList.mockResolvedValue({
    url: 'https://mapleroutine.store/v1/notices?limit=50&kind=game',
    status: 200,
    error: null,
    ms: 42,
    data: { items: [notice('game-149862', '서버가 든 공지')], nextCursor: null },
  })
  serverDetail.mockResolvedValue({
    url: 'https://mapleroutine.store/v1/notices/game-149862',
    status: 200,
    error: null,
    ms: 30,
    data: { ...notice('game-149862', '점검'), blocks: [{ type: 'text', text: '펼친 본문' }] },
  })
})

describe('출처', () => {
  // 서버가 아직 안 찼을 때도 무언가 보여야 한다. 그래서 넥슨이 기본이다.
  it('들어오면 넥슨부터 부른다', async () => {
    await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(nexonList).toHaveBeenCalledWith('game')
    })
    expect(serverList).not.toHaveBeenCalled()
  })

  it('출처를 서버로 바꾸면 서버를 부른다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('우리 서버 보기'))
    })

    expect(serverList).toHaveBeenCalledWith('game')
  })
})

describe('분류 고르기', () => {
  it('칩을 누르면 그 분류로 넥슨을 다시 부른다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시샵 보기'))
    })

    expect(nexonList).toHaveBeenCalledWith('cashshop')
  })
})

describe('넥슨 목록', () => {
  it('제목과 notice_id 를 세운다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByText('9/10(목) 넥슨 정기점검 안내')).toBeTruthy()
    })
    expect(view.getByText(/notice_id=149862/)).toBeTruthy()
  })

  it('이벤트 기간이 있으면 함께 적는다', async () => {
    nexonList.mockResolvedValue({
      path: '/maplestory/v1/notice-event',
      error: null,
      ms: 100,
      data: [
        {
          ...넥슨한건,
          title: '스페셜 썬데이 메이플',
          date_event_start: '2026-09-06T00:00+09:00',
          date_event_end: '2026-09-06T23:59+09:00',
        },
      ],
    })
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByText(/2026-09-06T00:00\+09:00 ~ 2026-09-06T23:59\+09:00/)).toBeTruthy()
    })
  })

  it('상시 판매는 상시라고 적는다', async () => {
    nexonList.mockResolvedValue({
      path: '/maplestory/v1/notice-cashshop',
      error: null,
      ms: 100,
      data: [{ ...넥슨한건, date_sale_start: null, date_sale_end: null, ongoing_flag: 'true' }],
    })
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByText('상시')).toBeTruthy()
    })
  })

  // 이 도구가 존재하는 이유다. 제품 화면은 이 둘을 같은 빈 화면으로 그린다.
  it('0건과 조회 실패를 가른다', async () => {
    nexonList.mockResolvedValue({ path: '/maplestory/v1/notice', error: null, ms: 80, data: [] })
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByTestId('probe-status').props.children).toContain('0건')
    })
  })

  it('실패하면 사유를 적는다', async () => {
    nexonList.mockResolvedValue({
      path: '/maplestory/v1/notice',
      error: '저장된 API 키가 없다. 로그인부터 해야 한다',
      ms: 0,
      data: null,
    })
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByText(/저장된 API 키가 없다/)).toBeTruthy()
    })
  })
})

describe('한 건을 펼치기', () => {
  it('넥슨 것은 원문 HTML 요약을 보여 준다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)
    await waitFor(() => view.getByText('9/10(목) 넥슨 정기점검 안내'))

    await act(async () => {
      fireEvent.press(view.getByLabelText('9/10(목) 넥슨 정기점검 안내 펼치기'))
    })

    expect(nexonDetail).toHaveBeenCalledWith('game', 149862)
    expect(view.getByText(/HTML 9자/)).toBeTruthy()
  })

  it('서버 것은 블록을 편다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)
    await act(async () => {
      fireEvent.press(view.getByLabelText('우리 서버 보기'))
    })
    await waitFor(() => view.getByText('서버가 든 공지'))

    await act(async () => {
      fireEvent.press(view.getByLabelText('서버가 든 공지 펼치기'))
    })

    expect(serverDetail).toHaveBeenCalledWith('game-149862')
    expect(view.getByText('펼친 본문')).toBeTruthy()
  })

  // 상세에 blocks 가 없으면 서버가 아직 옛 코드다. 그 사실이 화면에 보여야 한다.
  it('서버 상세에 블록이 없으면 없다고 말한다', async () => {
    serverDetail.mockResolvedValue({
      url: 'https://mapleroutine.store/v1/notices/game-149862',
      status: 200,
      error: null,
      ms: 30,
      data: notice('game-149862', '점검'),
    })
    const view = await renderOverlay(<NoticeKindsScreen />)
    await act(async () => {
      fireEvent.press(view.getByLabelText('우리 서버 보기'))
    })
    await waitFor(() => view.getByText('서버가 든 공지'))

    await act(async () => {
      fireEvent.press(view.getByLabelText('서버가 든 공지 펼치기'))
    })

    expect(view.getByText(/blocks 가 없다/)).toBeTruthy()
  })
})
