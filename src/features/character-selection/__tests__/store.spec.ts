// 선택 캐릭터의 **단일 진실 원천**.
//
// 정정 전에는 저장 키가 하나(`lastSelectedCharacter`)인데 메모리가 두 벌이었다 — 컨텐츠 스토어와
// 보스 스토어가 각자 `selectedOcid` 를 들고, 저장소에서 그 값을 읽는 것은 **하이드레이션 한
// 회차뿐**이었다(— «동시에 하나만» 이고 끝나면 잊는다). 그래서 컨텐츠에서
// 캐릭터를 바꾸면 저장소는 갱신되는데 이미 하이드레이션이 끝난 보스 스토어는 옛 값 그대로였다.

jest.mock('../../../storage/character-selection', () => ({
  getLastSelectedCharacter: jest.fn(),
  setLastSelectedCharacter: jest.fn(),
}))
const { getLastSelectedCharacter: getLastSelectedCharacterMock, setLastSelectedCharacter: setLastSelectedCharacterMock } =
  jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

import { useCharacterSelectionStore } from '../store'

beforeEach(() => {
  jest.clearAllMocks()
  getLastSelectedCharacterMock.mockResolvedValue(null)
  setLastSelectedCharacterMock.mockResolvedValue(undefined)
  useCharacterSelectionStore.setState({ selectedOcid: null })
})

describe('select', () => {
  it('메모리와 저장소를 함께 갱신한다', async () => {
    await useCharacterSelectionStore.getState().select('ocid-2')

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
    expect(setLastSelectedCharacterMock).toHaveBeenCalledWith('ocid-2')
  })

  // **이 테스트가 이슈 #245 자신이다.** 한 화면에서 고른 값이 다른 화면의 구독에 그대로 보여야
  // 한다 — 스토어가 하나이므로 «전파» 라는 단계가 아예 없다는 것이 결정 1 의 내용이다.
  it('고른 값은 구독자 전원이 같은 것을 본다', async () => {
    const 본_값: (string | null)[] = []
    const 구독_해제 = useCharacterSelectionStore.subscribe((state) => 본_값.push(state.selectedOcid))

    await useCharacterSelectionStore.getState().select('ocid-2')
    await useCharacterSelectionStore.getState().select('ocid-3')
    구독_해제()

    expect(본_값).toEqual(['ocid-2', 'ocid-3'])
  })
})

describe('hydrate', () => {
  it('저장된 값을 읽어 온다', async () => {
    getLastSelectedCharacterMock.mockResolvedValue('ocid-9')

    await useCharacterSelectionStore.getState().hydrate()

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-9')
  })

  it('저장된 값이 없으면 아무것도 안 세운다', async () => {
    await useCharacterSelectionStore.getState().hydrate()

    expect(useCharacterSelectionStore.getState().selectedOcid).toBeNull()
  })

  // **이것이 «두 벌» 재발을 막는 자리다.** 화면 넷이 각자 진입할 때마다 이 문을 지나는데, 매번
  // 저장소를 다시 읽어 덮으면 늦게 도착한 하이드레이션이 방금 고른 값을 되돌린다.
  it('이미 고른 값이 있으면 저장소를 읽지 않는다', async () => {
    await useCharacterSelectionStore.getState().select('ocid-2')
    getLastSelectedCharacterMock.mockClear()

    await useCharacterSelectionStore.getState().hydrate()

    expect(getLastSelectedCharacterMock).not.toHaveBeenCalled()
    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
  })

  it('여러 화면이 동시에 들어와도 결과가 같다', async () => {
    getLastSelectedCharacterMock.mockResolvedValue('ocid-9')

    await Promise.all([
      useCharacterSelectionStore.getState().hydrate(),
      useCharacterSelectionStore.getState().hydrate(),
      useCharacterSelectionStore.getState().hydrate(),
    ])

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-9')
  })
})
