// 대표 캐릭터 위젯의 움직임. 언제 무엇을 받고, 언제 움직이고 멈추는가를 본다. 무엇을 하는지는 `figure-motion` 테스트가 본다.

// 모션 줄이기는 분기로만 관측된다(`components/__tests__/reduced-motion.ts`).
jest.mock('react-native-reanimated', () =>
  // 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. `require` 로만 된다.
  require('../../../../components/__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import { mockReducedMotion } from '../../../../components/__tests__/reduced-motion'

import { act, fireEvent } from '@testing-library/react-native'
import { Image } from 'expo-image'

import { flattenStyle, renderAtom } from '../../../../components/__tests__/render-atom'
import { DEFAULT_FIGURE_MOTION } from '../../../../features/figure-motion/config'
import { lookFrameUrl } from '../../../../lib/character-look'
import { useScreenFocused } from '../../../../hooks/useScreenFocused'
import type { FigureMotion, LookFrame } from '../../../../types/figure-motion'
import { SHEET_FRAMES, figureFrames } from '../figure-motion'
import { RepresentativeCharacterWidget } from '../RepresentativeCharacterWidget'
import { FIGURE_CACHE_POLICY } from '../useFigureStep'
import { 대표_캐릭터, 뷰모델 } from './widget-fixture'

jest.mock('../../../../hooks/useScreenFocused', () => ({ useScreenFocused: jest.fn() }))
// 시트 안은 시트 테스트가 본다. 여기서는 열리는지만 본다.
jest.mock('../../FigureMotionSheet', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return { FigureMotionSheet: () => <View testID="figure-motion-sheet" /> }
})

const prefetch = jest.spyOn(Image, 'prefetch') as unknown as jest.Mock
const cachePath = jest.spyOn(Image, 'getCachePathAsync')

const 찌르기: FigureMotion = { actions: ['A24'], emotions: ['E02'], durationMs: 5000, rest: false }

type View = Awaited<ReturnType<typeof renderAtom>>

async function 위젯(representative = 대표_캐릭터): Promise<View> {
  const view = await renderAtom(<RepresentativeCharacterWidget data={뷰모델({ representative })} />)
  // 미리 받기가 끝나는 것을 기다린다.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0)
  })
  return view
}

function 층(view: View): ReturnType<View['getAllByTestId']> {
  return view.queryAllByTestId(/^representative-figure-A\d\d\./)
}

function 보이는그림(view: View): string[] {
  return 층(view)
    .filter((node) => flattenStyle(node.props.style).opacity === 1)
    .map((node) => String(node.props.testID).replace('representative-figure-', ''))
}

function 주소들(imageUrl: string, frames: readonly LookFrame[]): string[] {
  return frames.map((frame) => lookFrameUrl(imageUrl, frame))
}

/** 깜빡임 간격이 3.5초가 되는 무작위 값. 7.5초 동안 깜빡임이 꼭 든다 */
const RANDOM_VALUE = 0.5

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockReducedMotion(false)
  jest.mocked(useScreenFocused).mockReturnValue(true)
  prefetch.mockResolvedValue(true)
  cachePath.mockResolvedValue(null)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('그림 받기', () => {
  it('고른 조합의 그림을 한 번에 받는다', async () => {
    await 위젯({ ...대표_캐릭터, motion: 찌르기 })

    expect(prefetch.mock.calls[0][0]).toEqual(주소들(대표_캐릭터.imageUrl, figureFrames(찌르기)))
  })

  // 시트를 열기 전에 미리 다 받아 둔다(사용자 지정). 칸 그림은 조합이 없어 캐릭터마다 일정하다.
  it('시트의 칸 그림도 미리 받는다', async () => {
    await 위젯()

    expect(prefetch.mock.calls.map((call) => call[0])).toContainEqual(주소들(대표_캐릭터.imageUrl, SHEET_FRAMES))
  })

  // 넥슨 응답에는 캐시 지시가 없다. 디스크에 남기지 않으면 앱을 켤 때마다 또 받는다.
  it('받은 그림을 기기 디스크에 남기고 화면도 같은 캐시를 읽는다', async () => {
    const view = await 위젯()

    expect(FIGURE_CACHE_POLICY).toBe('memory-disk')
    prefetch.mock.calls.forEach((call) => {
      expect(call[1]).toBe(FIGURE_CACHE_POLICY)
    })
    층(view).forEach((node) => {
      expect(node.props.cachePolicy).toBe(FIGURE_CACHE_POLICY)
    })
  })

  // 그때그때 받으면 네트워크가 없을 때 그림이 안 보인다(사용자 지정).
  it('움직이는 동안 그림을 새로 받지 않는다', async () => {
    await 위젯({ ...대표_캐릭터, motion: { ...찌르기, actions: ['A24', 'A03', 'A06'], rest: true } })
    const 받은횟수 = prefetch.mock.calls.length

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120000)
    })

    expect(prefetch.mock.calls.length).toBe(받은횟수)
  })
})

describe('움직임', () => {
  // 그림을 그때 갈아 끼우면 다시 그리는 동안 깜빡인다.
  it('그림을 겹쳐 깔고 한 장만 보인다', async () => {
    const view = await 위젯()

    expect(층(view).length).toBeGreaterThan(1)
    expect(보이는그림(view)).toHaveLength(1)
  })

  it('고른 행동과 표정으로 움직인다', async () => {
    const view = await 위젯({ ...대표_캐릭터, motion: 찌르기 })
    const seen = new Set<string>()

    for (let tick = 0; tick < 100; tick += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(50)
      })
      보이는그림(view).forEach((key) => seen.add(key))
    }

    expect([...seen].sort()).toEqual(['A24.0|E02.0', 'A24.1|E02.0'])
  })

  // 깜빡임 간격과 동작 길이가 무작위라, 무작위를 고정하지 않으면 7.5초 안에 깜빡임이 들지 않는 판이 가끔 나온다.
  it('고르지 않은 캐릭터는 서기 1 로 서 있고 사이사이 눈을 깜빡인다', async () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(RANDOM_VALUE)
    const view = await 위젯()
    const seen = new Set<string>()

    for (let tick = 0; tick < 300; tick += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(25)
      })
      보이는그림(view).forEach((key) => seen.add(key))
    }
    random.mockRestore()

    expect([...seen].every((key) => key.startsWith('A00.'))).toBe(true)
    expect([...seen].some((key) => key.endsWith('|E06.1'))).toBe(true)
  })

  // 무기가 글자 위로 지나가게 한다(사용자 지정). 그림 칸에서 잘리거나 글자 뒤로 가면 안 된다.
  it('그림 칸에서 자르지 않고 글자 열 위에 그린다', async () => {
    const view = await 위젯()

    expect(flattenStyle(view.getByTestId('representative-figure-frame').props.style).overflow).toBe('visible')
    expect(flattenStyle(view.getByTestId('representative-figure-box').props.style).zIndex).toBeGreaterThan(0)
  })

  // 넥슨 그림은 모든 프레임이 같은 발 자리에 선다. 머리를 붙잡으면 발이 미끄러진다(사용자 지정).
  it('모든 그림을 같은 자리에 둔다', async () => {
    const view = await 위젯({ ...대표_캐릭터, motion: 찌르기 })
    const left = new Set(층(view).map((node) => flattenStyle(node.props.style).left))

    expect(left.size).toBe(1)
  })
})

// `Image.prefetch` 는 iOS 에서 캐시를 안 보고 항상 받는다. 실기기에서 앱을 켤 때마다 다시 받았다.
describe('이미 받은 그림', () => {
  it('디스크에 다 있으면 받지 않고 바로 움직인다', async () => {
    cachePath.mockResolvedValue('/cache/frame')

    const view = await 위젯()

    expect(prefetch).not.toHaveBeenCalled()
    expect(층(view).length).toBeGreaterThan(0)
  })

  it('디스크에 없는 그림만 받는다', async () => {
    const 없는주소 = lookFrameUrl(대표_캐릭터.imageUrl, { action: 'A00', frame: 1, emotion: 'E00', emotionFrame: 0 })
    cachePath.mockImplementation(async (url) => (url === 없는주소 ? null : '/cache/frame'))

    await 위젯()

    expect(prefetch.mock.calls[0][0]).toEqual([없는주소])
  })
})

// 외형이 바뀌면 `character/basic` 이 새 주소를 준다. 옛 주소는 옛 모습을 계속 주므로 주소가 곧 그 모습이다.
describe('캐릭터 그림이 바뀌면', () => {
  it('새 모습의 기본 그림이 먼저 서고, 새 그림을 받은 뒤 움직인다', async () => {
    const view = await 위젯()
    const 새주소 = 'https://example.test/new.png?wmotion=W02'
    let 받기끝: (ready: boolean) => void = () => {}
    prefetch.mockClear()
    prefetch.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          받기끝 = resolve
        }),
    )

    await view.rerender(
      <RepresentativeCharacterWidget data={뷰모델({ representative: { ...대표_캐릭터, imageUrl: 새주소 } })} />,
    )
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0)
    })

    expect(view.getByTestId('representative-figure').props.source).toEqual({ uri: 새주소 })
    expect(prefetch.mock.calls[0][0]).toEqual(주소들(새주소, figureFrames(DEFAULT_FIGURE_MOTION)))

    await act(async () => {
      받기끝(true)
      await jest.advanceTimersByTimeAsync(0)
    })

    expect(JSON.stringify(층(view)[0].props.source)).toContain(`${새주소}&action=A00.`)
  })
})

describe('움직이지 않을 때', () => {
  it('그림을 하나라도 못 받으면 기본 그림 한 장이다', async () => {
    prefetch.mockResolvedValue(false)

    const view = await 위젯()

    expect(view.getByTestId('representative-figure')).toBeTruthy()
    expect(층(view)).toHaveLength(0)
  })

  it('받기가 실패해도 기본 그림 한 장이다', async () => {
    prefetch.mockRejectedValue(new Error('offline'))

    const view = await 위젯()

    expect(view.getByTestId('representative-figure')).toBeTruthy()
  })

  it('디스크 확인이 실패해도 기본 그림 한 장이다', async () => {
    cachePath.mockRejectedValue(new Error('cache'))

    const view = await 위젯()

    expect(view.getByTestId('representative-figure')).toBeTruthy()
  })

  it('움직임 줄이기면 위젯 그림은 받지 않고 기본 그림 한 장이다', async () => {
    mockReducedMotion(true)

    const view = await 위젯()

    expect(prefetch.mock.calls.map((call) => call[0])).not.toContainEqual(
      주소들(대표_캐릭터.imageUrl, figureFrames(DEFAULT_FIGURE_MOTION)),
    )
    expect(view.getByTestId('representative-figure')).toBeTruthy()
  })

  // 조회 불가면 동작 프레임 대신 흰 실루엣이 멈춰 선다.
  it('조회 불가 캐릭터는 아무것도 받지 않는다', async () => {
    const view = await 위젯({ ...대표_캐릭터, unavailable: true })

    expect(prefetch).not.toHaveBeenCalled()
    expect(view.getByTestId('representative-figure-unknown')).toBeTruthy()
  })

  it('화면이 안 보이면 한 그림에 멈춘다', async () => {
    jest.mocked(useScreenFocused).mockReturnValue(false)
    const view = await 위젯({ ...대표_캐릭터, motion: 찌르기 })
    const 처음 = 보이는그림(view)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000)
    })

    expect(처음).toEqual(['A24.0|E02.0'])
    expect(보이는그림(view)).toEqual(처음)
  })
})

describe('동작 고르기 시트', () => {
  it('그림 칸을 누르면 시트가 열린다', async () => {
    const view = await 위젯()

    expect(view.queryByTestId('figure-motion-sheet')).toBeNull()
    await fireEvent.press(view.getByTestId('representative-figure-press'))

    expect(view.getByTestId('figure-motion-sheet')).toBeTruthy()
  })

  // 휘두르는 무기가 글자 위로 나간다. 그림이 터치를 받으면 글자 쪽을 눌러도 시트가 열린다.
  it('그림은 터치를 받지 않고, 누르는 곳은 그림 칸뿐이다', async () => {
    const view = await 위젯()

    expect(view.getByTestId('representative-figure-layer').props.pointerEvents).toBe('none')
  })

  // 실루엣은 멈춰 서 있어 고른 동작을 보여 줄 수 없다(사용자 지정).
  it('조회 불가로 실루엣이 서 있으면 누를 곳이 없다', async () => {
    const view = await 위젯({ ...대표_캐릭터, unavailable: true })

    expect(view.queryByTestId('representative-figure-press')).toBeNull()
  })
})
