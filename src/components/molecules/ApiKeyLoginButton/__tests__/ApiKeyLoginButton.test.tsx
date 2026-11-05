// 넥슨 로그인 입구가 꺼진 빌드에서 넥슨 버튼 자리에 서는 버튼.
//
// 여기서 막는 사고는 두 버튼의 높이가 갈리는 것이다. 입구를 켜면 같은 자리에 넥슨 버튼이 서는데,
// 높이가 다르면 그때 첫 화면의 배치가 바뀐다. 높이는 넥슨 그림의 비율에서 읽어 그림이 바뀌어도 함께 따라간다.

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { NexonLoginButton } from '../../NexonLoginButton/NexonLoginButton'
import { ApiKeyLoginButton } from '../ApiKeyLoginButton'

describe('ApiKeyLoginButton', () => {
  it('넥슨 버튼 그림과 같은 비율로 폭만 정하고 높이는 적지 않는다', async () => {
    const view = await renderAtom(
      <>
        <ApiKeyLoginButton onPress={() => {}} />
        <NexonLoginButton onPress={() => {}} />
      </>,
    )

    const button = flattenStyle(view.getByRole('button', { name: 'API 키로 로그인' }).props.style)
    const nexon = flattenStyle(view.getByTestId('nexon-login-button-image').props.style)
    expect(button.width).toBe('100%')
    expect(button.height).toBeUndefined()
    expect(button.aspectRatio).toBe(nexon.aspectRatio)
  })
})
