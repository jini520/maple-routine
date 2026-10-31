// 대표 캐릭터 위젯의 움직임. 언제 움직이고 언제 멈추는가를 본다. 고르는 규칙은 `figure-motion` 테스트가 본다.

// 모션 줄이기는 분기로만 관측된다(`components/__tests__/reduced-motion.ts`).
jest.mock('react-native-reanimated', () =>
  // 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. `require` 로만 된다.
  require('../../../../components/__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import { mockReducedMotion } from '../../../../components/__tests__/reduced-motion'

import { act } from '@testing-library/react-native'
import { Image } from 'react-native'

import { flattenStyle, renderAtom } from '../../../../components/__tests__/render-atom'
import { LOOK_FRAMES, lookFrameHeadShift } from '../../../../lib/character-look'
import { useScreenFocused } from '../../../../hooks/useScreenFocused'
import { RepresentativeCharacterWidget } from '../RepresentativeCharacterWidget'
import { 대표_캐릭터, 뷰모델 } from './widget-fixture'

jest.mock('../../../../hooks/useScreenFocused', () => ({ useScreenFocused: jest.fn() }))

const prefetch = jest.spyOn(Image, 'prefetch')

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
})

afterEach(() => {
  jest.useRealTimers()
})

describe('프레임을 다 받으면', () => {
  it('열세 프레임을 미리 받는다', async () => {
    await 위젯()

    expect(prefetch).toHaveBeenCalledTimes(LOOK_FRAMES.length)
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

describe('움직이지 않을 때', () => {
  it('프레임을 하나라도 못 받으면 기본 그림 한 장이다', async () => {
    prefetch.mockResolvedValueOnce(false)

    const view = await 위젯()

    expect(view.getByTestId('representative-figure')).toBeTruthy()
    expect(view.queryByTestId('representative-figure-idle0')).toBeNull()
  })

  it('받기가 실패해도 기본 그림 한 장이다', async () => {
    prefetch.mockRejectedValueOnce(new Error('offline'))

    const view = await 위젯()

    expect(view.getByTestId('representative-figure')).toBeTruthy()
  })

  it('움직임 줄이기면 받지도 않는다', async () => {
    mockReducedMotion(true)

    const view = await 위젯()

    expect(prefetch).not.toHaveBeenCalled()
    expect(view.getByTestId('representative-figure')).toBeTruthy()
  })

  it('조회 불가 캐릭터는 받지도 않는다', async () => {
    const view = await 위젯({ ...대표_캐릭터, unavailable: true })

    expect(prefetch).not.toHaveBeenCalled()
    expect(view.getByTestId('representative-figure')).toBeTruthy()
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
