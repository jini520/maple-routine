// 머리의 캐릭터 관리 버튼.
//
// 여기서 보는 것은 **무엇이 섰고 누르면 어디로 가는가** 다.

import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import { faceCropStyle } from '../../../lib/face-crop'
import { getThemeDefinition } from '../../../lib/theme/theme-registry'
import {
  __resetThemeAppearanceForTest,
  setThemeAppearance,
} from '../../../theme/appearance-store'
import { PORTRAIT_HEADER } from '../../../components/organisms/CharacterPortrait/portrait-metrics'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { setHapticsPort, __resetNativePortsForTest } from '../../../native/ports'
import { CharacterManageButton } from '../CharacterManageButton'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

const navigate = jest.fn()

const 대표 = { name: 'A', imageUrl: 'https://example.test/A.png' }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

describe('버튼', () => {
  it('누르면 캐릭터 관리로 push 한다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={대표} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐릭터 관리'))
    })

    expect(navigate).toHaveBeenCalledWith('SettingsCharacters')
  })

  // 얼굴은 원보다 작다. 그 차이가 원 안의 여백이고, 여기서 `slot` 을 넘기면 여백이 사라져
  // 얼굴이 테두리에 붙는다(고치기 전의 그 모양이다).
  it('얼굴은 원보다 작게 앉는다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={대표} />)
    const face = flattenStyle(view.getByTestId('character-manage-face-box').props.style)

    expect(face.width).toBe(PORTRAIT_HEADER.faceSize)
    expect(face.height).toBe(PORTRAIT_HEADER.faceSize)
  })

  // 대표 한 명으로 고정한다. 여러 캐릭터가 돌아가면 대표가 누구인지 흐려진다는 사용자 지정이다.
  it('얼굴은 대표 한 장이다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={대표} />)

    expect(view.getByTestId('character-manage-face').props.source).toEqual({ uri: 대표.imageUrl })
  })
})

// 원 안의 여백이 드러내는 바탕. **테마 토큰이 아니라 순백과 순검정**이다(사용자 지시). 토큰으로는
// 낼 수 없는 값이다 - `surface` 가 순백인 테마는 렌 하나고 라이트의 `bg` 는 테마마다 물들어 있다.
describe('원의 바탕', () => {
  afterEach(__resetThemeAppearanceForTest)

  it('라이트에서는 흰색이다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={대표} />)

    expect(flattenStyle(view.getByLabelText('캐릭터 관리').props.style).backgroundColor).toBe(
      '#ffffff',
    )
  })

  it('다크에서는 검정이다', async () => {
    setThemeAppearance('검은마법사', getThemeDefinition('검은마법사'))

    const view = await renderAtom(<CharacterManageButton portrait={대표} />)

    expect(flattenStyle(view.getByLabelText('캐릭터 관리').props.style).backgroundColor).toBe(
      '#000000',
    )
  })
})

describe('얼굴', () => {
  // 얼굴을 **넓게 잡은 크롭**으로 그린다(사용자 지시). 원이 48 까지 커지자 기본 크롭에서는
  // 머리통만 크게 보였다. `faceZoom` 을 떼면 이 단언이 깨진다.
  it('얼굴을 기본보다 넓게 잡아 머리통을 작게 그린다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={대표} />)
    const face = flattenStyle(view.getByTestId('character-manage-face').props.style)
    const 기본 = faceCropStyle(PORTRAIT_HEADER.faceSize)

    expect(face.width).toBeLessThan(기본.width)
  })
})

// 빈 원이나 지어낸 얼굴을 세우지 않는다. 추적이 없는 첫 실행에서도 문은 열려 있어야 한다.
describe('관리 대상이 없을 때', () => {
  it('사람 아이콘이 그 자리를 채운다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={null} />)

    expect(view.getByLabelText('캐릭터 관리')).toBeTruthy()
    expect(view.getByTestId('character-manage-fallback')).toBeTruthy()
    expect(view.queryByTestId('character-manage-face')).toBeNull()
  })

  it('얼굴이 있으면 아이콘은 없다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={대표} />)

    expect(view.queryByTestId('character-manage-fallback')).toBeNull()
  })
})

// 화면이 바뀌는 이동이라 두드림이 난다.
describe('촉각', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(__resetNativePortsForTest)

  it('누르면 한 번 난다', async () => {
    const view = await renderAtom(<CharacterManageButton portrait={대표} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐릭터 관리'))
    })

    expect(tap).toHaveBeenCalledTimes(1)
  })
})
