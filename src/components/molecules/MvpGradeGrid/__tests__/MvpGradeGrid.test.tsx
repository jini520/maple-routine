/** MVP 등급 일곱을 한 줄에서 고르는 7칸 격자. 칸은 명패 왼쪽을 자른 문양 타일과 등급 이름이다. */
import { fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { MvpGradeGrid } from '../MvpGradeGrid'

describe('MvpGradeGrid', () => {
  it('등급 일곱이 이름으로 서고 고른 칸이 선택으로 읽힌다', async () => {
    const view = await renderAtom(<MvpGradeGrid selected="gold" onSelect={jest.fn()} />)

    for (const name of ['일반', '브론즈', '실버', '골드', '다이아', '레드', '블랙']) {
      expect(view.getByLabelText(name)).toBeTruthy()
    }
    expect(view.getByLabelText('골드').props.accessibilityState?.selected).toBe(true)
    expect(view.getByLabelText('실버').props.accessibilityState?.selected).toBe(false)
  })

  it('누르면 그 등급을 준다', async () => {
    const onSelect = jest.fn()
    const view = await renderAtom(<MvpGradeGrid selected="gold" onSelect={onSelect} />)

    fireEvent.press(view.getByLabelText('레드'))

    expect(onSelect).toHaveBeenCalledWith('red')
  })
})
