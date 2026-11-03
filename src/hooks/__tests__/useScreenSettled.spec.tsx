// 화면이 자리 잡았는가. 초점만으로는 모자라다. 초점은 내비게이션 상태가 바뀌는 순간 돌아오는데, 그때부터 스택 전환이
// 끝날 때까지 화면이 움직이고 있어 그 위에서 무거운 그림을 돌리면 전환이 끊긴다.
import { NavigationContext } from '@react-navigation/native'
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { useScreenSettled } from '../useScreenSettled'
import { 초점가짜 } from './screen-focus-fake'

function Probe(): React.JSX.Element {
  return <Text>{useScreenSettled() ? '자리 잡음' : '아직'}</Text>
}

async function 화면에그리기(가짜: ReturnType<typeof 초점가짜>): ReturnType<typeof render> {
  return render(
    <NavigationContext.Provider value={가짜.navigation as never}>
      <Probe />
    </NavigationContext.Provider>,
  )
}

describe('자리 잡음', () => {
  it('보이고 전환이 없으면 자리 잡은 것이다', async () => {
    const view = await 화면에그리기(초점가짜(true))

    expect(view.getByText('자리 잡음')).toBeTruthy()
  })

  it('부모 스택의 전환이 진행 중이면 아직이고, 끝나면 자리 잡는다', async () => {
    const 부모 = 초점가짜(true)
    const 가짜 = 초점가짜(true, 부모)
    const view = await 화면에그리기(가짜)

    await 부모.보내기('transitionStart')
    expect(view.getByText('아직')).toBeTruthy()

    await 부모.보내기('transitionEnd')
    expect(view.getByText('자리 잡음')).toBeTruthy()
  })

  it('자기 화면의 전환도 본다', async () => {
    const 가짜 = 초점가짜(true)
    const view = await 화면에그리기(가짜)

    await 가짜.보내기('transitionStart')

    expect(view.getByText('아직')).toBeTruthy()
  })

  it('초점을 잃으면 전환이 없어도 아직이다', async () => {
    const 가짜 = 초점가짜(true)
    const view = await 화면에그리기(가짜)

    await 가짜.보내기('blur')

    expect(view.getByText('아직')).toBeTruthy()
  })

  // 컴포넌트 테스트는 내비게이터 없이 렌더한다. 거기서 멈추면 모든 홀로그램 테스트가 안 도는 그림을 본다.
  it('내비게이터 밖에서는 자리 잡은 것으로 둔다', async () => {
    const view = await render(<Probe />)

    expect(view.getByText('자리 잡음')).toBeTruthy()
  })
})
