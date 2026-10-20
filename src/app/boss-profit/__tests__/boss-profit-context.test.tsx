// 컨텍스트의 계약은 하나다. **밖에서 부르면 던진다.**
//
// 조용히 기본값을 돌려주면 잘못된 기간의 값으로 화면이 그려지고, 그 오류는 "왜 지난주 금액이
// 보이지"처럼 한참 뒤에야 드러난다.
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { useBossProfitContext } from '../boss-profit-context'

// 한글 이름은 대문자로 시작할 수 없어 `react-hooks/rules-of-hooks` 가 컴포넌트로 인식하지 못한다
// 훅을 부르는 테스트 컴포넌트만 영문 이름을 쓴다.
function PeriodLabel(): React.JSX.Element {
  const { periodKey, loadedPeriodKey } = useBossProfitContext()
  return <Text>{`${periodKey}/${loadedPeriodKey}`}</Text>
}

describe('useBossProfitContext', () => {

  // RNTL 14 의 `render` 는 비동기라 렌더 중 예외가 **동기 throw 가 아니라 거부된 프로미스**로 온다.
  it('Provider 밖에서는 던진다', async () => {
    // 콘솔의 React 에러 로그는 이 케이스의 관심사가 아니라 잠재운다.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(render(<PeriodLabel />)).rejects.toThrow(/BossProfitContextProvider/)
    } finally {
      spy.mockRestore()
    }
  })
})
