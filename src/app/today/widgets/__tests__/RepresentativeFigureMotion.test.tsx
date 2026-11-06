// 대표 캐릭터 위젯의 움직임. 언제 움직이고 언제 멈추는가를 본다. 고르는 규칙은 `figure-motion` 테스트가 본다.

// 모션 줄이기는 분기로만 관측된다(`components/__tests__/reduced-motion.ts`).
jest.mock('react-native-reanimated', () =>
  // 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. `require` 로만 된다.
  require('../../../../components/__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import { mockReducedMotion } from '../../../../components/__tests__/reduced-motion'

import { act } from '@testing-library/react-native'
import { Image } from 'expo-image'

import { flattenStyle, renderAtom } from '../../../../components/__tests__/render-atom'
import { LOOK_FRAMES, lookFrameHeadShift, lookFrameUrl } from '../../../../lib/character-look'
import { useScreenFocused } from '../../../../hooks/useScreenFocused'
import { RepresentativeCharacterWidget } from '../RepresentativeCharacterWidget'
import { FIGURE_CACHE_POLICY } from '../useFigureStep'
import { 대표_캐릭터, 뷰모델 } from './widget-fixture'

jest.mock('../../../../hooks/useScreenFocused', () => ({ useScreenFocused: jest.fn() }))

const prefetch = jest.spyOn(Image, 'prefetch') as unknown as jest.Mock
const cachePath = jest.spyOn(Image, 'getCachePathAsync')

async function 위젯(representative = 대표_캐릭터): Promise<Awaited<ReturnType<typeof renderAtom>>> {
  const view = await renderAtom(<RepresentativeCharacterWidget data={뷰모델({ representative })} />)
  // 미리 받기가 끝나는 것을 기다린다.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0)
  })
  return view
}

function 보이는프레임(view: Awaited<ReturnType<typeof renderAtom>>): string[] {
  return LOOK_FRAMES.filter(
    (frame) => flattenStyle(view.getByTestId(`representative-figure-${frame}`).props.style).opacity === 1,
  )
}

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

describe('프레임을 다 받으면', () => {
  it('열세 프레임을 한 번에 미리 받는다', async () => {
    await 위젯()

    expect(prefetch).toHaveBeenCalledTimes(1)
    expect(prefetch.mock.calls[0][0]).toEqual(LOOK_FRAMES.map((frame) => lookFrameUrl(대표_캐릭터.imageUrl, frame)))
  })

  // 넥슨 응답에는 캐시 지시가 없다. 디스크에 남기지 않으면 앱을 켤 때마다 13장을 또 받는다.
  it('받은 그림을 기기 디스크에 남기고 화면도 같은 캐시를 읽는다', async () => {
    const view = await 위젯()

    expect(FIGURE_CACHE_POLICY).toBe('memory-disk')
    expect(prefetch.mock.calls[0][1]).toBe(FIGURE_CACHE_POLICY)
    LOOK_FRAMES.forEach((frame) => {
      expect(view.getByTestId(`representative-figure-${frame}`).props.cachePolicy).toBe(FIGURE_CACHE_POLICY)
    })
  })

  // 프레임을 그때그때 그리면 처음 나오는 그림마다 깜빡인다.
  it('모든 프레임을 깔고 한 장만 보인다', async () => {
    const view = await 위젯()

    expect(보이는프레임(view)).toHaveLength(1)
  })

  it('시간이 지나면 다른 프레임으로 바뀐다', async () => {
    const view = await 위젯()
    const seen = new Set<string>()

    for (let tick = 0; tick < 200; tick += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100)
      })
      seen.add(보이는프레임(view)[0])
    }

    expect(seen.size).toBeGreaterThan(3)
  })

  // 무기가 글자 위로 지나가게 한다(사용자 지정). 그림 칸에서 잘리거나 글자 뒤로 가면 안 된다.
  it('그림 칸에서 자르지 않고 글자 열 위에 그린다', async () => {
    const view = await 위젯()

    expect(flattenStyle(view.getByTestId('representative-figure-frame').props.style).overflow).toBe('visible')
    expect(flattenStyle(view.getByTestId('representative-figure-box').props.style).zIndex).toBeGreaterThan(0)
  })

  // 좌우를 뒤집은 칸 안이라 값을 그림 기준으로 되돌린다.
  it('머리가 밀린 프레임은 그만큼 되돌려 그린다', async () => {
    const view = await 위젯()
    const left = (frame: (typeof LOOK_FRAMES)[number]): number =>
      flattenStyle(view.getByTestId(`representative-figure-${frame}`).props.style).left as number

    expect(lookFrameHeadShift('swing2')).toBeLessThan(0)
    expect(left('swing2')).toBeGreaterThan(left('swing1'))
  })
})

// `Image.prefetch` 는 iOS 에서 캐시를 안 보고 항상 받는다. 실기기에서 앱을 켤 때마다 13장을 다시 받았다.
describe('이미 받은 프레임', () => {
  it('디스크에 다 있으면 받지 않고 바로 움직인다', async () => {
    cachePath.mockResolvedValue('/cache/frame')

    const view = await 위젯()

    expect(prefetch).not.toHaveBeenCalled()
    expect(view.getByTestId('representative-figure-idle0')).toBeTruthy()
  })

  it('디스크에 없는 프레임만 받는다', async () => {
    const 있는주소 = lookFrameUrl(대표_캐릭터.imageUrl, 'wink')
    cachePath.mockImplementation(async (url) => (url === 있는주소 ? null : '/cache/frame'))

    await 위젯()

    expect(prefetch.mock.calls[0][0]).toEqual([있는주소])
  })
})

// 외형이 바뀌면 `character/basic` 이 새 주소를 준다. 옛 주소는 옛 모습을 계속 주므로 주소가 곧 그 모습이다.
describe('캐릭터 그림이 바뀌면', () => {
  it('새 모습의 기본 그림이 먼저 서고, 새 프레임을 받은 뒤 움직인다', async () => {
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
    expect(prefetch.mock.calls[0][0]).toEqual(LOOK_FRAMES.map((frame) => lookFrameUrl(새주소, frame)))

    await act(async () => {
      받기끝(true)
      await jest.advanceTimersByTimeAsync(0)
    })

    expect(JSON.stringify(view.getByTestId('representative-figure-idle0').props.source)).toContain(
      `${새주소}&action=A01.0`,
    )
  })
})

describe('움직이지 않을 때', () => {
  it('프레임을 하나라도 못 받으면 기본 그림 한 장이다', async () => {
    prefetch.mockResolvedValue(false)

    const view = await 위젯()

    expect(view.getByTestId('representative-figure')).toBeTruthy()
    expect(view.queryByTestId('representative-figure-idle0')).toBeNull()
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

  it('움직임 줄이기면 받지도 않는다', async () => {
    mockReducedMotion(true)

    const view = await 위젯()

    expect(prefetch).not.toHaveBeenCalled()
    expect(view.getByTestId('representative-figure')).toBeTruthy()
  })

  // 조회 불가면 동작 프레임 대신 흰 실루엣이 멈춰 선다.
  it('조회 불가 캐릭터는 받지도 않는다', async () => {
    const view = await 위젯({ ...대표_캐릭터, unavailable: true })

    expect(prefetch).not.toHaveBeenCalled()
    expect(view.getByTestId('representative-figure-unknown')).toBeTruthy()
  })

  it('화면이 안 보이면 첫 프레임에 멈춘다', async () => {
    jest.mocked(useScreenFocused).mockReturnValue(false)

    const view = await 위젯()

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000)
    })

    expect(보이는프레임(view)).toEqual(['idle0'])
  })
})
