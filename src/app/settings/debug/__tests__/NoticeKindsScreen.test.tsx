// 임시 점검 화면. 이 도구가 하는 일은 하나다 - **서버에 그 분류가 없는 것**과 **조회가
// 실패한 것**을 갈라 보여 주는 것. 둘 다 «아무것도 없음» 으로 보이면 화면만 보고는 못 가린다.
//
// ⚠️ 임시다. `src/app/settings/debug/` 폴더째 지우는 것이 폐기 절차다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../../components/__tests__/render-atom'
import type { Notice } from '../../../../types/notice'
import { probeDetail, probeList } from '../probe'
import { NoticeKindsScreen } from '../NoticeKindsScreen'

jest.mock('../probe', () => ({
  __esModule: true,
  probeList: jest.fn(),
  probeDetail: jest.fn(),
}))
jest.mock('../../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}))

const list = jest.mocked(probeList)
const detail = jest.mocked(probeDetail)

function notice(id: string, title: string): Notice {
  return { id, kind: 'game', title, body: '본문', publishedAt: '2026-09-09T07:24:00.000Z' }
}

function listOk(items: Notice[]) {
  return {
    url: 'https://mapleroutine.store/v1/notices?limit=50&kind=game',
    status: 200,
    error: null,
    ms: 42,
    data: { items, nextCursor: null },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  list.mockResolvedValue(listOk([notice('game-149862', '9/10(목) 넥슨 정기점검 안내')]))
  detail.mockResolvedValue({
    url: 'https://mapleroutine.store/v1/notices/game-149862',
    status: 200,
    error: null,
    ms: 30,
    data: { ...notice('game-149862', '점검'), blocks: [{ type: 'text', text: '펼친 본문' }] },
  })
})

describe('분류 고르기', () => {
  it('들어오면 게임 공지부터 조회한다', async () => {
    await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(list).toHaveBeenCalledWith('game')
    })
  })

  it('칩을 누르면 그 분류를 조회한다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시샵 보기'))
    })

    expect(list).toHaveBeenCalledWith('cashshop')
  })

  it('받은 것을 목록에 세운다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByText('9/10(목) 넥슨 정기점검 안내')).toBeTruthy()
    })
  })

  // 이 도구가 존재하는 이유다. 제품 화면은 이 둘을 같은 빈 화면으로 그린다.
  it('0건과 조회 실패를 가른다', async () => {
    list.mockResolvedValue(listOk([]))
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByTestId('probe-status').props.children).toContain('0건')
    })
  })

  it('실패하면 사유를 적는다', async () => {
    list.mockResolvedValue({
      url: 'https://mapleroutine.store/v1/notices?limit=50&kind=game',
      status: null,
      error: 'Network request failed',
      ms: 12,
      data: null,
    })
    const view = await renderOverlay(<NoticeKindsScreen />)

    await waitFor(() => {
      expect(view.getByText(/Network request failed/)).toBeTruthy()
    })
  })
})

describe('한 건을 펼치기', () => {
  it('누르면 상세를 받아 블록을 편다', async () => {
    const view = await renderOverlay(<NoticeKindsScreen />)
    await waitFor(() => view.getByText('9/10(목) 넥슨 정기점검 안내'))

    await act(async () => {
      fireEvent.press(view.getByLabelText('9/10(목) 넥슨 정기점검 안내 펼치기'))
    })

    expect(detail).toHaveBeenCalledWith('game-149862')
    expect(view.getByText('펼친 본문')).toBeTruthy()
  })

  // 상세에 blocks 가 없으면 서버가 아직 옛 코드다. 그 사실이 화면에 보여야 한다.
  it('블록이 없으면 없다고 말한다', async () => {
    detail.mockResolvedValue({
      url: 'https://mapleroutine.store/v1/notices/game-149862',
      status: 200,
      error: null,
      ms: 30,
      data: notice('game-149862', '점검'),
    })
    const view = await renderOverlay(<NoticeKindsScreen />)
    await waitFor(() => view.getByText('9/10(목) 넥슨 정기점검 안내'))

    await act(async () => {
      fireEvent.press(view.getByLabelText('9/10(목) 넥슨 정기점검 안내 펼치기'))
    })

    expect(view.getByText(/blocks 가 없다/)).toBeTruthy()
  })
})
