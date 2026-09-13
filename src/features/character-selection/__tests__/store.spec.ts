// 선택 캐릭터의 **단일 진실 원천**.
//
// 정정 전에는 저장 키가 하나(`lastSelectedCharacter`)인데 메모리가 두 벌이었다. 컨텐츠 스토어와
// 보스 스토어가 각자 `selectedOcid` 를 들고, 저장소에서 그 값을 읽는 것은 **하이드레이션 한
// 회차뿐**이었다(**동시에 하나만** 이고 끝나면 잊는다). 그래서 컨텐츠에서
// 캐릭터를 바꾸면 저장소는 갱신되는데 이미 하이드레이션이 끝난 보스 스토어는 옛 값 그대로였다.

jest.mock('../../../storage/character-selection', () => ({
  getLastSelectedCharacter: jest.fn(),
  setLastSelectedCharacter: jest.fn(),
  getRepresentativeCharacter: jest.fn(),
  setRepresentativeCharacter: jest.fn(),
  clearRepresentativeCharacter: jest.fn(),
}))
const {
  getLastSelectedCharacter: getLastSelectedCharacterMock,
  setLastSelectedCharacter: setLastSelectedCharacterMock,
  getRepresentativeCharacter: getRepresentativeCharacterMock,
  setRepresentativeCharacter: setRepresentativeCharacterMock,
  clearRepresentativeCharacter: clearRepresentativeCharacterMock,
} = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

import { useCharacterSelectionStore } from '../store'

beforeEach(() => {
  jest.clearAllMocks()
  getLastSelectedCharacterMock.mockResolvedValue(null)
  setLastSelectedCharacterMock.mockResolvedValue(undefined)
  getRepresentativeCharacterMock.mockResolvedValue(null)
  setRepresentativeCharacterMock.mockResolvedValue(undefined)
  clearRepresentativeCharacterMock.mockResolvedValue(undefined)
  useCharacterSelectionStore.setState({
    selectedOcid: null,
    representativeOcid: null,
    isRepresentativeHydrated: false,
  })
})

/** 밖에서 끝을 정하는 약속. 늦게 도착하는 저장소 읽기를 흉내 낸다. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('select', () => {
  it('메모리와 저장소를 함께 갱신한다', async () => {
    await useCharacterSelectionStore.getState().select('ocid-2')

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-2')
    expect(setLastSelectedCharacterMock).toHaveBeenCalledWith('ocid-2')
  })

  // 한 화면에서 고른 값이 다른 화면의 구독에 그대로 보여야 한다. 스토어가 하나이므로 전파라는
  // 단계가 아예 없다.
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

  // **이것이 두 벌 재발을 막는 자리다.** 화면 넷이 각자 진입할 때마다 이 문을 지나는데, 매번
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

// 대표 표식도 이 스토어가 든다. today 가 화면 상태로 사본을 들던 때는 캐릭터 관리에서 대표를 바꿔도
// 당기기 전까지 옛 캐릭터를 그렸다(#395).
describe('대표 표식', () => {
  it('hydrate 가 저장된 대표를 함께 읽는다', async () => {
    getRepresentativeCharacterMock.mockResolvedValue('ocid-3')

    await useCharacterSelectionStore.getState().hydrate()

    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('ocid-3')
    expect(useCharacterSelectionStore.getState().isRepresentativeHydrated).toBe(true)
  })

  // 미지정(`null`)도 읽은 결과다. 안 가르면 대표를 안 고른 사용자가 진입할 때마다 저장소를 다시
  // 읽고, 늦게 온 읽기가 방금 지운 대표를 되살린다.
  it('미지정도 읽은 것으로 남아 다시 읽지 않는다', async () => {
    await useCharacterSelectionStore.getState().hydrate()
    await useCharacterSelectionStore.getState().hydrate()

    expect(useCharacterSelectionStore.getState().representativeOcid).toBeNull()
    expect(useCharacterSelectionStore.getState().isRepresentativeHydrated).toBe(true)
    expect(getRepresentativeCharacterMock).toHaveBeenCalledTimes(1)
  })

  it('고른 캐릭터가 이미 있어도 대표는 읽는다', async () => {
    await useCharacterSelectionStore.getState().select('ocid-2')
    getRepresentativeCharacterMock.mockResolvedValue('ocid-3')

    await useCharacterSelectionStore.getState().hydrate()

    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('ocid-3')
  })

  it('setRepresentative 는 메모리를 먼저 바꾸고 저장소에 쓴다', async () => {
    const write = deferred<void>()
    setRepresentativeCharacterMock.mockReturnValue(write.promise)

    const pending = useCharacterSelectionStore.getState().setRepresentative('ocid-2')

    // 저장이 끝나기 전에 구독자가 새 대표를 본다.
    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('ocid-2')
    expect(useCharacterSelectionStore.getState().isRepresentativeHydrated).toBe(true)
    expect(setRepresentativeCharacterMock).toHaveBeenCalledWith('ocid-2')

    write.resolve()
    await pending
  })

  it('null 이면 저장된 대표를 지운다', async () => {
    useCharacterSelectionStore.setState({ representativeOcid: 'ocid-2', isRepresentativeHydrated: true })

    await useCharacterSelectionStore.getState().setRepresentative(null)

    expect(useCharacterSelectionStore.getState().representativeOcid).toBeNull()
    expect(clearRepresentativeCharacterMock).toHaveBeenCalledTimes(1)
    expect(setRepresentativeCharacterMock).not.toHaveBeenCalled()
  })

  // 쓰기 실패를 삼키면 호출부가 실패를 모른다. 메모리는 새 값 그대로다(사용자가 받아들인 대가).
  it('쓰기가 실패하면 호출부로 올리고 메모리는 새 값을 든다', async () => {
    setRepresentativeCharacterMock.mockRejectedValue(new Error('disk full'))

    await expect(useCharacterSelectionStore.getState().setRepresentative('ocid-2')).rejects.toThrow('disk full')

    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('ocid-2')
  })

  it('대표를 쓴 뒤의 hydrate 는 대표를 읽지 않는다', async () => {
    await useCharacterSelectionStore.getState().setRepresentative('ocid-2')

    await useCharacterSelectionStore.getState().hydrate()

    expect(getRepresentativeCharacterMock).not.toHaveBeenCalled()
    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('ocid-2')
  })

  // 온보딩의 순서. 목록을 저장하면 today 가 서서 hydrate 를 부르고, 대표는 그 뒤에 쓴다. 저장소
  // 읽기가 쓰기보다 늦게 도착해도 사용자가 고른 대표가 남아야 한다.
  it('기다리는 동안 대표를 썼으면 늦게 온 읽기가 덮지 않는다', async () => {
    const read = deferred<string | null>()
    getRepresentativeCharacterMock.mockReturnValue(read.promise)

    const hydrating = useCharacterSelectionStore.getState().hydrate()
    await useCharacterSelectionStore.getState().setRepresentative('ocid-2')
    read.resolve(null)
    await hydrating

    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('ocid-2')
  })

  // `hydrate` 는 스케줄러 스토어의 `loadTrackedOcids` 가 `Promise.all` 로 기다린다. 표식 하나를 못
  // 읽었다고 추적 목록 적재까지 실패하면 안 된다.
  it('표식을 못 읽으면 던지지 않고 안 읽음으로 남는다', async () => {
    getLastSelectedCharacterMock.mockResolvedValue('ocid-9')
    getRepresentativeCharacterMock.mockRejectedValue(new Error('native'))

    await expect(useCharacterSelectionStore.getState().hydrate()).resolves.toBeUndefined()

    expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-9')
    expect(useCharacterSelectionStore.getState().representativeOcid).toBeNull()
    expect(useCharacterSelectionStore.getState().isRepresentativeHydrated).toBe(false)
  })

  // 월드 이전 확인은 대표를 옮길지를 저장소 함수가 정한다. 그 뒤 메모리를 저장소에 맞춘다.
  it('reloadRepresentative 는 이미 든 값이 있어도 저장소 값으로 덮는다', async () => {
    useCharacterSelectionStore.setState({ representativeOcid: 'old', isRepresentativeHydrated: true })
    getRepresentativeCharacterMock.mockResolvedValue('new')

    await useCharacterSelectionStore.getState().reloadRepresentative()

    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('new')
  })

  it('reloadRepresentative 가 못 읽으면 든 값을 그대로 둔다', async () => {
    useCharacterSelectionStore.setState({ representativeOcid: 'old', isRepresentativeHydrated: true })
    getRepresentativeCharacterMock.mockRejectedValue(new Error('native'))

    await expect(useCharacterSelectionStore.getState().reloadRepresentative()).resolves.toBeUndefined()

    expect(useCharacterSelectionStore.getState().representativeOcid).toBe('old')
  })
})
