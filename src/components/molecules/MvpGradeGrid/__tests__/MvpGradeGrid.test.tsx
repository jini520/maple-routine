/** MVP 등급 일곱을 한 줄에서 고르는 7칸 격자. 칸은 명패 왼쪽을 자른 문양 타일과 등급 이름이다. */
import { fireEvent } from '@testing-library/react-native'

import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import { resolveControlColors } from '../../../../theme/theme-vars'
import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
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

  // 고른 칸은 바탕으로 말한다. 링을 두르면 문양 가장자리 곁에 선이 하나 더 생긴다.
  it('고른 타일만 primary-tint 바탕이고, 어느 칸에도 테두리가 없다', async () => {
    const view = await renderAtom(<MvpGradeGrid selected="gold" onSelect={jest.fn()} />)

    expect(flattenStyle(view.getByLabelText('골드').props.style).backgroundColor).toBe(기본테마.primaryTint)
    expect(flattenStyle(view.getByLabelText('실버').props.style).backgroundColor).toBe(
      resolveControlColors(getThemeDefinition('머쉬맘')).track,
    )
    const bordered = findAllOfType(view.toJSON(), 'View').filter((node) => flattenStyle(node.props.style).borderWidth !== undefined)
    expect(bordered).toEqual([])
  })
})
