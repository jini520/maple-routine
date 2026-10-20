// 넥슨 디자인 가이드대로 만든 로그인 버튼. **검수가 이 버튼의 캡처를 본다.**
//
// 여기서 막는 사고는 그림이 일그러지는 것이다. 가이드는 심볼과 레이블을 `고정 영역` 으로, 좌우를
// `확장영역` 으로 적어 폭이 늘어도 내용이 안 늘고, 잡아 늘이면 금지 항목 둘(`텍스트 왜곡 및 변형` ·
// `가이드에서 벗어난 사이즈 및 비율 적용`)을 한 번에 어긴다.

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { NexonLoginButton } from '../NexonLoginButton'

describe('NexonLoginButton', () => {
  it('폭만 정하고 높이는 안 적는다', async () => {
    // 두 축이 다 정해지면 Yoga 가 종횡비를 안 쓰고 그림이 일그러진다. resizeMode 로는 안 낫는다.
    // 높이를 적고 싶어지는 자리라 여기서 못박는다.
    const view = await renderAtom(<NexonLoginButton onPress={() => {}} />)

    const style = flattenStyle(view.getByTestId('nexon-login-button-image').props.style)
    expect(style.width).toBe('100%')
    expect(style.height).toBeUndefined()
  })

  it('읽어 주는 이름은 버튼이 든다. 그림은 안 읽는다', async () => {
    // 글자가 그림 안에 있어 스크린리더가 읽을 것이 없다. 이름을 그림에도 달면 같은 말이 두 번 난다.
    const view = await renderAtom(<NexonLoginButton onPress={() => {}} />)

    expect(view.getByLabelText('넥슨ID 로그인').props.accessibilityRole).toBe('button')
    expect(view.getByTestId('nexon-login-button-image').props.accessible).toBe(false)
  })
})
