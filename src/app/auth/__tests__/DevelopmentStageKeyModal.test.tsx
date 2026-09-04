// 개발 단계 키 차단 모달.
//
// 스토어를 모킹하지 않고 `setState` 로 몬다. 옆 파일(`ApiKeyNoticeModal.test.tsx`)과 같은 관례다.
// `acknowledgeDevelopmentStageKey` 만 갈아 끼운다. 실물은 상태를 되돌리고, 여기서는 불렸는가가
// 계약이다.
//
// 이 파일이 보는 것은 **문구와 배선**이지 마크업이 아니다. 골격이 `NoticeModal` 로 옮겨 가도
// 그대로 통과해야 한다. 그러라고 옮기기 전에 먼저 썼다.
import { fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

import { useAuthStore } from '../../../features/auth/store'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { DevelopmentStageKeyModal } from '../DevelopmentStageKeyModal'
import { GUIDE_URL } from '../api-key-links'

let acknowledgeDevelopmentStageKey: jest.Mock

beforeEach(() => {
  acknowledgeDevelopmentStageKey = jest.fn()
  useAuthStore.setState({ developmentStageBlocked: false, acknowledgeDevelopmentStageKey })
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('DevelopmentStageKeyModal', () => {
  // falsy 검사가 의도다. 스토어를 부분 모킹한 테스트에서 `undefined` 가 와도 차단 UI 가 뜨면
  // 안 된다. 켜라고 명시했을 때만 켜진다.
  it('막히지 않았으면 아무것도 그리지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(<DevelopmentStageKeyModal />)

    expect(queryByTestId('development-stage-key-overlay')).toBeNull()
  })

  describe('막혔을 때', () => {
    beforeEach(() => {
      useAuthStore.setState({ developmentStageBlocked: true })
    })

    // 제목이 `개발 단계` 라는 낱말을 안 쓴다. 이 사람은 그 말이 무엇인지 모르고 그것을 골랐으므로
    // 모르는 말을 돌려주면 무엇이 잘못됐는지가 전달되지 않는다.
    it('제목은 못 쓴다는 사실이지 낱말 풀이가 아니다', async () => {
      const { getByTestId } = await renderOverlay(<DevelopmentStageKeyModal />)

      expect(getByTestId('development-stage-key-title')).toHaveTextContent(
        '이 키로는 연결할 수 없습니다',
      )
    })

    // 두 단계는 같은 축의 두 값으로 만난다. 뜻을 설명하는 대신 그 자리에 다른 값이 있었다는
    // 사실을 준다. 넉 줄이 함께 있어야 그 관계가 선다.
    it('넣은 키와 필요한 키를 한 표에서 마주 세운다', async () => {
      const { getByText } = await renderOverlay(<DevelopmentStageKeyModal />)

      expect(getByText('넣으신 키')).toBeTruthy()
      expect(getByText('개발 단계')).toBeTruthy()
      expect(getByText('필요한 키')).toBeTruthy()
      expect(getByText('서비스 단계')).toBeTruthy()
    })

    it('무엇을 해야 하는지 한 문장으로 준다', async () => {
      const { getByText } = await renderOverlay(<DevelopmentStageKeyModal />)

      expect(
        getByText('넥슨 오픈 API에서 단계를 ‘서비스 단계’로 골라 키를 새로 발급받은 뒤 입력해주세요.'),
      ).toBeTruthy()
    })

    // 주 동작은 되돌아가는 것이다. 이 모달은 길을 막고 서 있어 사용자가 바로 할 일이 폼으로
    // 돌아가는 것이라, 가장 큰 버튼이 앱 밖으로 내보내면 안 된다.
    it('주 버튼은 폼으로 되돌린다. 앱 밖으로 내보내지 않는다', async () => {
      const { getByText } = await renderOverlay(<DevelopmentStageKeyModal />)

      await fireEvent.press(getByText('다시 입력하기'))

      expect(acknowledgeDevelopmentStageKey).toHaveBeenCalledTimes(1)
      expect(Linking.openURL).not.toHaveBeenCalled()
    })

    // 발급 안내는 도움말이라 버튼 아래 인라인 링크로 내려간다. 폼이 이미 쓰는 주소와 같은 것을
    // 써야 한다. 두 벌이 되면 안내 사이트를 옮기는 날 한쪽만 따라간다.
    it('발급 안내 링크는 폼과 같은 주소로 나간다', async () => {
      const { getByText } = await renderOverlay(<DevelopmentStageKeyModal />)

      await fireEvent.press(getByText('발급 방법 자세히 보기'))

      expect(Linking.openURL).toHaveBeenCalledWith(GUIDE_URL)
      expect(acknowledgeDevelopmentStageKey).not.toHaveBeenCalled()
    })

    // 닫을 수 있다. 옆의 `ApiKeyNoticeModal` 이 안 닫히는 것은 뒤 화면이 이미 제 기능을 못 하기
    // 때문인데, 여기는 뒤에 키 입력 폼이 멀쩡히 서 있어 닫는 것이 곧 다시 넣는 것이다.
    it('오버레이를 눌러 닫을 수 있다', async () => {
      const { getByTestId } = await renderOverlay(<DevelopmentStageKeyModal />)

      await fireEvent.press(getByTestId('development-stage-key-overlay'))

      expect(acknowledgeDevelopmentStageKey).toHaveBeenCalledTimes(1)
    })

    it('안드로이드 뒤로가기로도 닫힌다', async () => {
      const { getByTestId } = await renderOverlay(<DevelopmentStageKeyModal />)

      await fireEvent(getByTestId('development-stage-key-overlay-modal'), 'requestClose')

      expect(acknowledgeDevelopmentStageKey).toHaveBeenCalledTimes(1)
    })
  })
})
