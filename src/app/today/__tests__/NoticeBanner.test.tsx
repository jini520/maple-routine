// today 맨 위의 공지 배너.
//
// 묻는 것은 넷이다. ① 세울 공지가 없으면 **아무것도 안 그린다**(빈 상자를 두면 격자가 이유 없이
// 밀린다). ② 접힘에는 버튼이 없다. ③ 머리를 누르면 본문과 버튼 둘이 열리고 다시 누르면 접힌다.
// ④ 버튼 둘이 각자 제 일을 한다.
//
// 고르는 규칙은 `pick-banner-notice.spec.ts`, 앱 공지 쿼리와 닫은 기록은 `notice-query.spec.tsx` 가 본다.
jest.mock('../../../features/notice/notice-query', () => ({ useNoticeBanner: jest.fn() }))
jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

import { act, fireEvent, screen } from '@testing-library/react-native'

import { renderAtom } from '../../../components/__tests__/render-atom'
import { useNoticeBanner } from '../../../features/notice/notice-query'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import type { Notice } from '../../../types/notice'
import { NoticeBanner } from '../NoticeBanner'

const mockedBanner = jest.mocked(useNoticeBanner)
const mockedNavigation = jest.mocked(useScreenNavigation)
const navigate = jest.fn()
const dismiss = jest.fn(async () => undefined)

const 점검공지: Notice = {
  id: 'notice-1',
  title: '9월 정기 점검 안내',
  body: '9월 10일 오전 2시부터 4시까지 서버 점검이 진행됩니다.',
  kind: 'app',
  publishedAt: '2026-09-08T01:00:00.000Z',
}

/** 훅이 세울 공지. 화면은 훅만 읽는다. 렌더 **전**에 부른다. */
function 공지를_세운다(notice: Notice | null = 점검공지): void {
  mockedBanner.mockReturnValue({ notice, dismiss })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedNavigation.mockReturnValue({ navigate } as unknown as ReturnType<typeof useScreenNavigation>)
  공지를_세운다(null)
})

/**
 * 누른다. **`act` 로 감싸는 것이 계약이다.** 안 감싸면 상태 갱신이 이 문장 뒤로 밀려, 펼쳐졌는지
 * 묻는 단언이 아직 접힌 트리를 본다.
 */
async function 누른다(element: ReturnType<typeof screen.getByLabelText>): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

describe('세울 것이 없을 때', () => {
  it('아무것도 안 그린다', async () => {
    await renderAtom(<NoticeBanner />)

    expect(screen.queryByTestId('today-notice-banner')).toBeNull()
  })
})

describe('접힘', () => {
  it('버튼도 본문도 아직 없다', async () => {
    공지를_세운다()
    await renderAtom(<NoticeBanner />)

    expect(screen.queryByText('다시 보지 않기')).toBeNull()
    expect(screen.queryByText('자세히 보기')).toBeNull()
    expect(screen.queryByText(점검공지.body)).toBeNull()
  })
})

describe('펼침', () => {
  it('머리를 누르면 본문과 버튼 둘이 열린다', async () => {
    공지를_세운다()
    await renderAtom(<NoticeBanner />)

    await 누른다(screen.getByLabelText('9월 정기 점검 안내'))

    expect(screen.getByText(점검공지.body)).toBeTruthy()
    expect(screen.getByText('다시 보지 않기')).toBeTruthy()
    expect(screen.getByText('자세히 보기')).toBeTruthy()
  })

  it('다시 누르면 접힌다', async () => {
    공지를_세운다()
    await renderAtom(<NoticeBanner />)

    await 누른다(screen.getByLabelText('9월 정기 점검 안내'))
    await 누른다(screen.getByLabelText('9월 정기 점검 안내'))

    expect(screen.queryByText('자세히 보기')).toBeNull()
  })

  // 머리 탭이 곧장 상세로 가면 `다시 보지 않기` 를 고를 자리가 사라진다.
  it('머리 탭은 이동이 아니다', async () => {
    공지를_세운다()
    await renderAtom(<NoticeBanner />)

    await 누른다(screen.getByLabelText('9월 정기 점검 안내'))

    expect(navigate).not.toHaveBeenCalled()
  })

  // 새 공지가 오면 접힌 채로 서야 한다. 앞의 것을 펼쳐 뒀다고 다음 것이 펼쳐져 있으면 안 된다.
  it('공지가 바뀌면 접힌 채로 선다', async () => {
    공지를_세운다()
    const view = await renderAtom(<NoticeBanner />)
    await 누른다(screen.getByLabelText('9월 정기 점검 안내'))

    공지를_세운다({
      id: 'notice-2',
      title: '9월 이벤트 안내',
      body: '이벤트 본문',
      kind: 'app',
      publishedAt: '2026-09-09T01:00:00.000Z',
    })
    // 쿼리가 새 공지를 내면 같은 트리가 다시 그려진다. `renderAtom` 과 같은 감싸개라야 상태가 남는다.
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <NoticeBanner />
        </ThemeProvider>,
      )
    })

    expect(screen.getByText('9월 이벤트 안내')).toBeTruthy()
    expect(screen.queryByText('자세히 보기')).toBeNull()
  })
})

describe('버튼 둘', () => {
  it('자세히 보기는 그 공지의 상세로 민다', async () => {
    공지를_세운다()
    await renderAtom(<NoticeBanner />)
    await 누른다(screen.getByLabelText('9월 정기 점검 안내'))

    await 누른다(screen.getByText('자세히 보기'))

    expect(navigate).toHaveBeenCalledWith('SettingsNoticeDetail', { noticeId: 'notice-1' })
  })

  // 배너를 내리고 기기에 적는 것은 훅의 일이다(`notice-query.spec.tsx`).
  it('다시 보지 않기는 훅의 닫기를 부른다', async () => {
    공지를_세운다()
    await renderAtom(<NoticeBanner />)
    await 누른다(screen.getByLabelText('9월 정기 점검 안내'))

    await 누른다(screen.getByText('다시 보지 않기'))

    expect(dismiss).toHaveBeenCalledTimes(1)
  })
})
