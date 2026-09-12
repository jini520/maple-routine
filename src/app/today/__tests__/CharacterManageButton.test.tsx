// 머리의 캐릭터 관리 버튼.
//
// **움직임의 값은 여기서 안 본다**. `header-portrait-motion.ts` 가 들고 그쪽 테스트가 붙든다.
// 여기서 보는 것은 **무엇이 섰고 누르면 어디로 가는가**, 그리고 움직임 줄이기에서 안 도는가 다.

// 모션 줄이기는 분기로만 관측된다(`components/__tests__/reduced-motion.ts`).
jest.mock('react-native-reanimated', () =>
  // 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. `require` 로만 된다.
  require('../../../components/__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import { mockReducedMotion, withRepeatSpy } from '../../../components/__tests__/reduced-motion'

import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import { PORTRAIT_HEADER } from '../../../components/organisms/CharacterPortrait/portrait-metrics'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { setHapticsPort, __resetNativePortsForTest } from '../../../native/ports'
import { CharacterManageButton } from '../CharacterManageButton'
import type { HeaderPortraitView } from '../view-model'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

const navigate = jest.fn()

function 얼굴(name: string): HeaderPortraitView {
  return { ocid: `ocid-${name}`, name, imageUrl: `https://example.test/${name}.png` }
}

const 셋 = [얼굴('A'), 얼굴('B'), 얼굴('C')]

beforeEach(() => {
  jest.clearAllMocks()
  mockReducedMotion(false)
  withRepeatSpy.mockClear()
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

describe('버튼', () => {
  // 원 안에 글자가 없다. 이 이름이 무엇이 열리는지 말하는 유일한 자리다.
  it('이름으로 자기가 여는 화면을 말한다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)

    expect(view.getByLabelText('캐릭터 관리')).toBeTruthy()
  })

  it('누르면 캐릭터 관리로 push 한다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐릭터 관리'))
    })

    expect(navigate).toHaveBeenCalledWith('SettingsCharacters')
  })

  // 지름이 치수 표에서 온다. 화면에 숫자로 적으면 다음 규격이 또 다른 자리에 선다.
  it('지름이 치수 표에서 온다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)
    const circle = flattenStyle(view.getByLabelText('캐릭터 관리').props.style)

    expect(circle.width).toBe(PORTRAIT_HEADER.faceSize)
    expect(circle.height).toBe(PORTRAIT_HEADER.faceSize)
  })

  // 얼굴이 원보다 크지 않아도 오르내리는 동안 테두리를 넘는다. 원이 안 자르면 둥근 틀 밖에
  // 얼굴 조각이 뜬다.
  it('원이 얼굴을 자른다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)

    expect(flattenStyle(view.getByLabelText('캐릭터 관리').props.style).overflow).toBe('hidden')
  })
})

describe('도는 얼굴', () => {
  it('받은 얼굴이 다 마운트된 채로 있다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)

    for (let slot = 0; slot < 셋.length; slot += 1) {
      expect(view.getByTestId(`character-manage-face-${slot}`)).toBeTruthy()
    }
  })

  it('하나뿐이면 그 하나만 선다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={[얼굴('A')]} />)

    expect(view.getByTestId('character-manage-face-0')).toBeTruthy()
    expect(view.queryByTestId('character-manage-face-1')).toBeNull()
  })

  // 얼굴 그림은 뷰모델이 나른 것을 그대로 쓴다. 모르는 얼굴을 비슷한 것으로 때우지 않는다.
  it('그림은 목록이 든 URL 이다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)

    expect(view.getByTestId('character-manage-face-0').props.source).toEqual({
      uri: 셋[0].imageUrl,
    })
  })
})

// 빈 원이나 지어낸 얼굴을 세우지 않는다. 추적이 없는 첫 실행에서도 문은 열려 있어야 한다.
describe('관리 대상이 없을 때', () => {
  it('사람 아이콘이 그 자리를 채운다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={[]} />)

    expect(view.getByLabelText('캐릭터 관리')).toBeTruthy()
    expect(view.getByTestId('character-manage-fallback')).toBeTruthy()
    expect(view.queryByTestId('character-manage-face-0')).toBeNull()
  })

  it('얼굴이 있으면 아이콘은 없다', async () => {
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)

    expect(view.queryByTestId('character-manage-fallback')).toBeNull()
  })
})

// 반복 애니메이션을 걸었는가로만 관측된다. 렌더 트리는 켠 쪽과 끈 쪽이 문자 단위로 같다
// (`reduced-motion.ts` 의 `withRepeatSpy` 주석).
describe('움직임 줄이기', () => {
  it('켜져 있으면 안 돈다', async () => {
    mockReducedMotion(true)

    await renderAtom(<CharacterManageButton portraits={셋} />)

    expect(withRepeatSpy).not.toHaveBeenCalled()
  })

  it('꺼져 있으면 돈다', async () => {
    await renderAtom(<CharacterManageButton portraits={셋} />)

    expect(withRepeatSpy).toHaveBeenCalled()
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
    const view = await renderAtom(<CharacterManageButton portraits={셋} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐릭터 관리'))
    })

    expect(tap).toHaveBeenCalledTimes(1)
  })
})
