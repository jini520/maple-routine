// 떠 있는 ＋ 버튼의 원. 가계부 · 파티 약속의 펼치는 ＋, 보스 수익의 아이템 가격 버튼, 인벤토리의 넣기 버튼이
// 함께 쓴다. 셋이 같은 층에 떠 있는 물건이라 크기와 그림자가 같아야 하고, 각자 그리면 한쪽만 고칠 때 갈린다.
import { act, fireEvent, render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { flattenStyle, renderAtom, renderOverlay, 기본테마 } from '../../../__tests__/render-atom'
import { FAB_DIAMETER_PX, FAB_SHADOW, useFabPlacement, type FabPlacement } from '../../../../lib/fab-metrics'
import { boxShadowOf } from '../../../../lib/shadow'
import { installNoopNativePorts } from '../../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../../native/ports'
import { Fab, FabAnchor } from '../Fab'

afterEach(installNoopNativePorts)

function 원(onPress: () => void = () => {}): ReturnType<typeof render> {
  return renderAtom(
    <Fab label="기록 추가" onPress={onPress} elevationTestID="fab-elevation">
      <Text>＋</Text>
    </Fab>,
  )
}

describe('원', () => {
  it('지름이 화면이 콘텐츠 끝에 갚는 값과 같은 상수에서 나온다', async () => {
    const view = await 원()

    const circle = flattenStyle(view.getByLabelText('기록 추가').props.style)
    expect(circle.width).toBe(FAB_DIAMETER_PX)
    expect(circle.height).toBe(FAB_DIAMETER_PX)
  })

  it('그림자는 원을 감싸는 뷰가 들고, 모양은 그 뷰의 반경에서 나온다', async () => {
    const view = await 원()

    const elevation = flattenStyle(view.getByTestId('fab-elevation').props.style)
    expect(elevation.boxShadow).toBe(boxShadowOf(기본테마.shadowColor, FAB_SHADOW))
    expect(elevation.borderRadius).toBe(999)
  })

  // 원 자신이 그림자를 들면 안의 그림을 가두려고 `overflow-hidden` 을 줄 때 그림자가 잘린다.
  it('원 자신은 그림자도 테두리도 없다', async () => {
    const view = await 원()

    const circle = flattenStyle(view.getByLabelText('기록 추가').props.style)
    expect(circle.boxShadow).toBeUndefined()
    expect(circle.borderWidth).toBeUndefined()
  })

  // iOS 전용 프롭은 안드로이드에 안 닿고, `elevation` 을 함께 주면 그림자가 두 번 그려진다.
  it('iOS 전용 그림자 프롭과 elevation 을 쓰지 않는다', async () => {
    const view = await 원()

    const elevation = flattenStyle(view.getByTestId('fab-elevation').props.style)
    expect(elevation.shadowOpacity).toBeUndefined()
    expect(elevation.shadowRadius).toBeUndefined()
    expect(elevation.elevation).toBeUndefined()
  })
})

describe('누르기', () => {
  it('누르면 촉각을 한 번 내고 넘긴 함수를 한 번 부른다', async () => {
    const tap = jest.fn(async () => {})
    setHapticsPort({ tap, select: async () => {} })
    const onPress = jest.fn()
    const view = await 원(onPress)

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '기록 추가' }))
    })

    expect(tap).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('FabAnchor', () => {
  it('아래 · 오른쪽 거리가 떠 있는 원의 자리와 같다', async () => {
    const seen = jest.fn<void, [FabPlacement]>()
    function Probe(): null {
      seen(useFabPlacement())
      return null
    }
    const view = await renderOverlay(
      <>
        <Probe />
        <FabAnchor testID="anchor">
          <Text>＋</Text>
        </FabAnchor>
      </>,
    )

    const style = flattenStyle(view.getByTestId('anchor').props.style)
    const expected = seen.mock.lastCall?.[0]
    expect(expected).toBeDefined()
    expect(style.bottom).toBe(expected?.bottomPx)
    expect(style.right).toBe(expected?.rightPx)
    expect(style.position).toBe('absolute')
  })

  // 오른쪽 여백도 이 상자의 넓이라, 상자가 터치를 받으면 버튼 옆의 목록 줄이 안 눌린다.
  it('상자 자신은 터치를 먹지 않는다', async () => {
    const view = await renderOverlay(
      <FabAnchor testID="anchor">
        <Text>＋</Text>
      </FabAnchor>,
    )

    expect(view.getByTestId('anchor').props.pointerEvents).toBe('box-none')
  })
})
