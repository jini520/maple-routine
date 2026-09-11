/**
 * 조회할 수 없다를 값 자리에 적는 알약.
 *
 * 색은 `Badge` 의 `error` 와 같은 값이다. 갈리는 것은 **아이콘이 함께 든다**는 것 하나이고,
 * `Badge` 가 `Text` 하나거나 그라디언트 상자 하나라 그것을 못 한다.
 */
import { fireEvent } from '@testing-library/react-native'

import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { UnavailableBadge } from '../UnavailableBadge'

describe('UnavailableBadge', () => {
  // 아이콘이 `Badge` 와 갈리는 자리다. lucide 그림은 `testID` 가 안 통해 트리에서 본다.
  it('아이콘과 글자가 한 상자에 든다', async () => {
    const view = await renderAtom(<UnavailableBadge label="조회 불가" />)

    expect(view.getByText('조회 불가')).toBeTruthy()
    expect(findAllOfType(view.toJSON(), 'RNSVGSvgView')).toHaveLength(1)
  })

  it('글자색은 `Badge` 의 `error` 와 같은 값이다', async () => {
    const view = await renderAtom(<UnavailableBadge label="조회 불가" />)

    expect(flattenStyle(view.getByText('조회 불가').props.style).color).toBe(기본테마.errorInk)
  })

  // 누를 수 있는 자리와 아닌 자리가 있다. 보스 수익의 카드는 눌러 설명 팝오버를 열고, 오늘
  // 화면의 대표 카드는 열 팝오버가 없다.
  it('`onPress` 를 주면 버튼이 된다', async () => {
    const onPress = jest.fn()
    const view = await renderAtom(<UnavailableBadge label="조회 불가" onPress={onPress} />)

    fireEvent.press(view.getByLabelText('조회 불가'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('안 주면 그림이다. 스크린리더에 버튼으로 안 들린다', async () => {
    const view = await renderAtom(<UnavailableBadge label="조회 불가" />)

    expect(view.queryByRole('button')).toBeNull()
  })

  // 오늘 화면의 위젯은 칸에 묶여 있다. 상자가 여백으로 자라므로 호출부가 정한다.
  it('글자 배수는 호출부가 정한다', async () => {
    const 그냥 = await renderAtom(<UnavailableBadge label="조회 불가" />)
    expect(그냥.getByText('조회 불가').props.allowFontScaling).not.toBe(false)

    const 고정 = await renderAtom(<UnavailableBadge fixed label="조회 불가" />)
    expect(고정.getByText('조회 불가').props.allowFontScaling).toBe(false)
  })
})
