// 대표 캐릭터 동작 시트. 이 파일이 지키는 것 여섯.
// ① 행동과 표정은 `행동 · 표정` 세그먼트로 한쪽씩 보이고, 세그먼트 글자에 고른 수와 최대 수가 보인다
// ② 칸 이름은 정한 이름이고 깜빡임 칸은 없다. 이름은 한 줄이고 넘치면 글자를 줄인다
// ③ 행동 3개 · 표정 5개를 다 고르면 나머지 칸이 흐려지고 눌러도 붙지 않는다
// ④ 칸을 고르면 그 조합의 그림을 그때 받는다
// ⑤ `적용` 해야 그 캐릭터 몫으로 저장된다. 동작 시간 · 쉬는 시간도 함께다
// ⑥ 하나도 고르지 않으면 `적용` 은 글자 그대로 눌리지 않는다
// ⑦ 칸은 그 동작의 그림을 겹쳐 깔고 한 장만 보이며, 움직임 줄이기면 첫 그림에 멈춘다

// 모션 줄이기는 분기로만 관측된다(`components/__tests__/reduced-motion.ts`).
jest.mock('react-native-reanimated', () =>
  // 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. `require` 로만 된다.
  require('../../../components/__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import { mockReducedMotion } from '../../../components/__tests__/reduced-motion'

import type { ReactNode } from 'react'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { Image } from 'expo-image'

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { useFigureMotionStore } from '../../../features/figure-motion/store'
import { lookFrameUrl } from '../../../lib/character-look'
import type { FigureMotion } from '../../../types/figure-motion'
import { FigureMotionSheet } from '../FigureMotionSheet'
import { figureFrames } from '../widgets/figure-motion'

// 시트 라이브러리를 맨 뷰로 바꾼다. 여기서 보는 것은 시트 안에 무엇이 서는가다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    useBottomSheetInternal: () =>
      jest.requireActual<typeof import('../../../components/__tests__/bottom-sheet-internal-fake')>(
        '../../../components/__tests__/bottom-sheet-internal-fake',
      ).fakeBottomSheetInternal(),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

const 그림 = 'https://open.api.nexon.com/static/maplestory/character/look/abc?wmotion=W00'
const 걷기: FigureMotion = { actions: ['A03'], emotions: ['E02'], durationMs: 5000, rest: false }

const save = jest.fn((ocid: string, motion: FigureMotion) => {
  useFigureMotionStore.setState({ motions: { ...useFigureMotionStore.getState().motions, [ocid]: motion } })
  return Promise.resolve()
})
const prefetch = jest.spyOn(Image, 'prefetch') as unknown as jest.Mock
const cachePath = jest.spyOn(Image, 'getCachePathAsync')

// 미리보기가 움직인다. 진짜 시계면 테스트가 끝난 뒤에도 그림이 바뀐다.
beforeEach(() => {
  jest.useFakeTimers()
  mockReducedMotion(false)
  save.mockClear()
  prefetch.mockReset().mockResolvedValue(true)
  cachePath.mockReset().mockResolvedValue(null)
  useFigureMotionStore.setState({ motions: {}, save })
})

afterEach(() => {
  jest.useRealTimers()
})

async function 시트(motion: FigureMotion = 걷기, onClose = jest.fn()) {
  const view = await renderOverlay(<FigureMotionSheet ocid="ocid-1" name="단풍루틴" imageUrl={그림} motion={motion} onClose={onClose} />)
  return { view, onClose }
}

type View = Awaited<ReturnType<typeof 시트>>['view']

function 고른칸(view: View): string[] {
  return view.queryAllByTestId(/^figure-motion-check-/).map((node) => String(node.props.testID).replace('figure-motion-check-', ''))
    .sort()
}

describe('행동과 표정', () => {
  it('처음에는 행동 칸만 보이고, `표정` 을 누르면 표정 칸만 보인다', async () => {
    const { view } = await 시트()

    expect(view.getByText('서기 · 이동')).toBeTruthy()
    expect(view.queryByTestId('figure-motion-tile-E02')).toBeNull()

    await fireEvent.press(view.getByText(/^표정 \d\/5$/))

    expect(view.getByTestId('figure-motion-tile-E02')).toBeTruthy()
    expect(view.queryByTestId('figure-motion-tile-A03')).toBeNull()
  })

  // 행동 3개 · 표정 5개까지다. 어느 쪽을 보고 있어도 두 쪽의 수가 다 보인다(사용자 지정).
  it('세그먼트 글자에 고른 수와 최대 수가 보이고, 고르면 바로 바뀐다', async () => {
    const { view } = await 시트()

    expect(view.getByText('행동 1/3')).toBeTruthy()
    expect(view.getByText('표정 1/5')).toBeTruthy()

    await fireEvent.press(view.getByTestId('figure-motion-tile-A24'))

    expect(view.getByText('행동 2/3')).toBeTruthy()
  })

  it('그 캐릭터가 고른 칸이 골라져 있다', async () => {
    const { view } = await 시트()

    expect(고른칸(view)).toEqual(['A03'])
    await fireEvent.press(view.getByText(/^표정 \d\/5$/))
    expect(고른칸(view)).toEqual(['E02'])
  })
})

describe('칸 이름', () => {
  it('정한 이름이고, 공격의 마지막은 다음 차례 숫자다', async () => {
    const { view } = await 시트()

    for (const 이름 of ['서기 1', '숨돌리기', '한손 휘두르기 4', '폴암 휘두르기 3', '두손 찌르기 3', '쏘기 3', '유령 앉기']) {
      expect(view.getByText(이름)).toBeTruthy()
    }
  })

  // 깜빡임은 기본 표정 사이에 앱이 넣는다(사용자 지정).
  it('표정에는 바꾼 이름이 서고 깜빡임 칸은 없다', async () => {
    const { view } = await 시트()
    await fireEvent.press(view.getByText(/^표정 \d\/5$/))

    for (const 이름 of ['분노', '꾸벅꾸벅', '뿅', '허걱허걱', '곤란', '울렁울']) {
      expect(view.getByText(이름)).toBeTruthy()
    }
    expect(view.queryByText('깜빡임')).toBeNull()
    expect(view.queryByTestId('figure-motion-tile-E06')).toBeNull()
  })

  // 말줄임과 줄바꿈을 쓰지 않는다는 디자인 원칙. 넘치면 글자를 줄인다(사용자 지정).
  it('이름은 한 줄이고 칸보다 길면 글자를 줄인다', async () => {
    const { view } = await 시트()
    const 이름 = view.getByText('폴암 휘두르기 1')

    expect(이름.props.numberOfLines).toBe(1)
    expect(이름.props.adjustsFontSizeToFit).toBe(true)
  })
})

describe('고를 수 있는 수', () => {
  it('행동 3개를 다 고르면 나머지 칸이 흐려지고 눌러도 붙지 않는다', async () => {
    const { view } = await 시트({ ...걷기, actions: ['A03', 'A24', 'A06'] })

    expect(flattenStyle(view.getByTestId('figure-motion-tile-A11').props.style).opacity).toBeLessThan(1)
    expect(flattenStyle(view.getByTestId('figure-motion-tile-A03').props.style).opacity ?? 1).toBe(1)

    await fireEvent.press(view.getByTestId('figure-motion-tile-A11'))
    expect(고른칸(view)).toEqual(['A03', 'A06', 'A24'])

    await fireEvent.press(view.getByTestId('figure-motion-tile-A24'))
    await fireEvent.press(view.getByTestId('figure-motion-tile-A11'))
    expect(고른칸(view)).toEqual(['A03', 'A06', 'A11'])
  })

  it('표정은 5개까지다', async () => {
    const { view } = await 시트({ ...걷기, emotions: ['E00', 'E01', 'E02', 'E03', 'E04'] })
    await fireEvent.press(view.getByText(/^표정 \d\/5$/))

    await fireEvent.press(view.getByTestId('figure-motion-tile-E05'))

    expect(고른칸(view)).toEqual(['E00', 'E01', 'E02', 'E03', 'E04'])
  })
})

describe('그림 받기', () => {
  // 위젯은 움직이는 동안 그림을 새로 받지 않는다. 고르는 그때 받아 둔다(사용자 지정).
  it('칸을 고르면 고른 조합의 그림을 받는다', async () => {
    const { view } = await 시트()
    await fireEvent.press(view.getByTestId('figure-motion-tile-A24'))
    await act(async () => {
      await Promise.resolve()
    })

    const 기대 = figureFrames({ ...걷기, actions: ['A03', 'A24'] }).map((frame) => lookFrameUrl(그림, frame))
    expect(prefetch.mock.calls.map((call) => call[0])).toContainEqual(기대)
  })
})

describe('미리보기', () => {
  // 그림은 300×300 이라 미리보기 상자 위로 넘쳐 동작 시간 세그먼트를 덮는다. 터치를 받으면 세그먼트가 안 눌린다.
  it('미리보기 그림은 터치를 받지 않는다', async () => {
    const { view } = await 시트()

    expect(view.getByTestId('figure-motion-preview-layer').props.pointerEvents).toBe('none')
  })
})

describe('적용', () => {
  it('누르기 전에는 저장하지 않고, 누르면 그 캐릭터 몫으로 동작 시간 · 쉬는 시간까지 저장하고 닫는다', async () => {
    const { view, onClose } = await 시트()

    await fireEvent.press(view.getByTestId('figure-motion-tile-A24'))
    await fireEvent.press(view.getByText('10초'))
    await fireEvent.press(view.getByTestId('figure-motion-rest'))
    expect(save).not.toHaveBeenCalled()

    await fireEvent.press(view.getByRole('button', { name: '적용' }))

    expect(save).toHaveBeenCalledWith('ocid-1', { actions: ['A03', 'A24'], emotions: ['E02'], durationMs: 10000, rest: true })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('행동을 하나도 고르지 않으면 글자는 그대로 두고 누를 수 없다', async () => {
    const { view } = await 시트()

    await fireEvent.press(view.getByTestId('figure-motion-tile-A03'))
    const 버튼 = view.getByRole('button', { name: '적용' })
    await fireEvent.press(버튼)

    expect(버튼.props.accessibilityState?.disabled ?? 버튼.props['aria-disabled']).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('표정을 하나도 고르지 않아도 누를 수 없다', async () => {
    const { view } = await 시트()
    await fireEvent.press(view.getByText(/^표정 \d\/5$/))

    await fireEvent.press(view.getByTestId('figure-motion-tile-E02'))
    await fireEvent.press(view.getByRole('button', { name: '적용' }))

    expect(save).not.toHaveBeenCalled()
  })
})

describe('칸 그림', () => {
  function 보이는층(view: View, code: string): string[] {
    return view
      .queryAllByTestId(new RegExp(`^figure-motion-layer-${code}-`))
      .filter((node) => flattenStyle(node.props.style).opacity === 1)
      .map((node) => String(node.props.testID))
  }

  // 그림을 그때 갈아 끼우면 다시 그리는 동안 깜빡인다. 위젯과 같은 방식이다.
  it('그 동작의 그림을 겹쳐 깔고 한 장만 보이며, 시간이 지나면 다음 장으로 넘어간다', async () => {
    const { view } = await 시트()
    const 처음 = 보이는층(view, 'A03')

    expect(view.queryAllByTestId(/^figure-motion-layer-A03-/).length).toBeGreaterThan(1)
    expect(처음).toHaveLength(1)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(200)
    })

    expect(보이는층(view, 'A03')).toHaveLength(1)
    expect(보이는층(view, 'A03')).not.toEqual(처음)
  })

  it('움직임 줄이기면 첫 그림에 멈춘다', async () => {
    mockReducedMotion(true)
    const { view } = await 시트()
    const 처음 = 보이는층(view, 'A03')

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000)
    })

    expect(처음).toHaveLength(1)
    expect(보이는층(view, 'A03')).toEqual(처음)
  })
})
