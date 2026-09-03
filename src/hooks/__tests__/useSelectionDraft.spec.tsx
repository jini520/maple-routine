// 저장 전의 선택 초안. **네트워크가 없어 이 자리에서 다 잰다.**
//
// 가르기 전에는 이 규칙들이 425줄짜리 컨트롤러 안에 있어서, 대표 3상태나 저장 활성 조건을 물으려면
// 화면을 통째로 세워야 했다. 세우는 것은 저장된 대표 읽기 하나뿐이다.
//
// 파일 끝의 두 묶음은 `moveOcid` 를 직접 묻는다. 끌기 자체는 jest 가 한 줄도 못 보므로(제스처는
// 네이티브가 인식하고 레이아웃도 계산되지 않는다) **어떤 배열이 되는가** 만 순수 함수로 내려 둔
// 것이고, 마지막 묶음은 그 함수가 라이브러리와 같은 규칙인지 맞대 본다.
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { getRepresentativeCharacter } from '../../storage/character-selection'
import { moveOcid, useSelectionDraft, type SelectionDraft } from '../useSelectionDraft'

// 라이브러리가 끌기 중에 쓰는 재배열 함수. 패키지 얼굴에 없어 깊은 경로로 가져오고, 그쪽에는
// 타입이 안 딸려 오므로 **우리가 부르는 모양만** 여기 적는다(넷째 인자 `fixedItemKeys` 는 안 쓴다).
// 경로가 바뀌면 이 스위트가 불러오기에서 죽는다. 조용히 통과하지 않는다.
//
// 패키지가 함께 싣는 `src/` 쪽을 가리키면 안 된다. 그쪽은 TypeScript 원본이라 tsc 가 함께 검사하고,
// 그 안의 gesture-handler v3 어댑터가 우리가 쓰는 2.x 타입과 안 맞아 에러 열한 개가 난다.
const { reorderInsert } = require('react-native-sortables/dist/module/utils/layout') as {
  reorderInsert: (indexToKey: string[], fromIndex: number, toIndex: number) => string[]
}

jest.mock('../../storage/character-selection', () => ({
  getRepresentativeCharacter: jest.fn(),
}))

const 대표읽기 = getRepresentativeCharacter as jest.MockedFunction<typeof getRepresentativeCharacter>

const 저장된목록 = ['a1', 'a2', 'a3']

async function 초안(tracked: string[] | null = 저장된목록) {
  const view = await renderHook<SelectionDraft, { ocids: string[] | null }>(
    ({ ocids }) => useSelectionDraft(ocids),
    { initialProps: { ocids: tracked } },
  )
  // 저장된 대표 읽기가 끝나야 `isDirty` 가 제자리를 잡는다.
  await waitFor(() => expect(대표읽기).toHaveBeenCalled())
  return view
}

beforeEach(() => {
  대표읽기.mockResolvedValue(null)
})

describe('편집하기 전에는 저장된 목록이 그대로 보인다', () => {
  it('저장된 목록이 곧 선택된 목록이다', async () => {
    const { result } = await 초안()

    expect(result.current.selectedOcids).toEqual(저장된목록)
    expect(result.current.isDirty).toBe(false)
  })

  it('아직 안 읽혔으면 빈 목록이고, 늦게 도착하면 그것이 보인다', async () => {
    const { result, rerender } = await 초안(null)
    expect(result.current.selectedOcids).toEqual([])

    await rerender({ ocids: 저장된목록 })

    expect(result.current.selectedOcids).toEqual(저장된목록)
    // 늦게 도착한 것은 사용자의 편집이 아니다.
    expect(result.current.isDirty).toBe(false)
  })

  it('한 번 손대면 그 뒤에 도착하는 저장본이 편집을 덮지 않는다', async () => {
    const { result, rerender } = await 초안()

    await act(async () => {
      result.current.addCharacter('b1')
    })
    await rerender({ ocids: ['전혀', '다른', '목록'] })

    expect(result.current.selectedOcids).toEqual([...저장된목록, 'b1'])
  })
})

describe('목록 편집', () => {
  it('새로 고른 캐릭터는 배열 끝이다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.addCharacter('b1')
    })

    expect(result.current.selectedOcids).toEqual(['a1', 'a2', 'a3', 'b1'])
  })

  it('이미 있는 것을 다시 고르면 아무 일도 없다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.addCharacter('a2')
    })

    expect(result.current.selectedOcids).toEqual(저장된목록)
  })

  it('빼면 그 자리만 사라지고 나머지 차례는 그대로다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.removeCharacter('a2')
    })

    expect(result.current.selectedOcids).toEqual(['a1', 'a3'])
  })

  it('옮기면 놓은 자리가 곧 배열 순서다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.moveCharacter(0, 2)
    })

    expect(result.current.selectedOcids).toEqual(['a2', 'a3', 'a1'])
  })
})

describe('저장 활성 조건', () => {
  it('집합이 같아도 순서가 다르면 참이다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.moveCharacter(0, 1)
    })

    expect(result.current.isDirty).toBe(true)
  })

  it('옮겼다 되돌리면 거짓으로 돌아온다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.moveCharacter(0, 1)
    })
    await act(async () => {
      result.current.moveCharacter(1, 0)
    })

    expect(result.current.isDirty).toBe(false)
  })

  it('집합이 달라지면 참이다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.removeCharacter('a3')
    })

    expect(result.current.isDirty).toBe(true)
  })

  it('대표만 달라져도 참이다', async () => {
    const { result } = await 초안()

    await act(async () => {
      result.current.setRepresentative('a2')
    })

    expect(result.current.selectedOcids).toEqual(저장된목록)
    expect(result.current.isDirty).toBe(true)
  })
})

describe('대표는 세 상태다', () => {
  it('저장된 대표를 읽어 와 채운다', async () => {
    대표읽기.mockResolvedValue('a2')
    const { result } = await 초안()

    await waitFor(() => expect(result.current.representativeOcid).toBe('a2'))
    expect(result.current.isDirty).toBe(false)
  })

  it('대표를 빼면 별이 비고, 지우는 코드 없이 그렇게 된다', async () => {
    대표읽기.mockResolvedValue('a2')
    const { result } = await 초안()
    await waitFor(() => expect(result.current.representativeOcid).toBe('a2'))

    await act(async () => {
      result.current.removeCharacter('a2')
    })

    expect(result.current.representativeOcid).toBeNull()
    expect(result.current.isDirty).toBe(true)
  })

  it('같은 별을 다시 눌러도 바뀌는 것이 없다', async () => {
    대표읽기.mockResolvedValue('a2')
    const { result } = await 초안()
    await waitFor(() => expect(result.current.representativeOcid).toBe('a2'))

    await act(async () => {
      result.current.setRepresentative('a2')
    })

    expect(result.current.representativeOcid).toBe('a2')
    expect(result.current.isDirty).toBe(false)
  })

  it('저장된 대표를 못 읽어도 화면이 선다. 아무 별도 안 채워진다', async () => {
    대표읽기.mockRejectedValue(new Error('읽기 실패'))
    const { result } = await 초안()

    expect(result.current.selectedOcids).toEqual(저장된목록)
    expect(result.current.representativeOcid).toBeNull()
  })
})

const 순서목록 = ['a1', 'a2', 'a3', 'b1']

describe('moveOcid: 놓은 자리가 곧 배열 순서다', () => {
  it('아래로 옮기면 그 자리에 끼워지고 사이가 한 칸씩 당겨진다', () => {
    expect(moveOcid(순서목록, 0, 2)).toEqual(['a2', 'a3', 'a1', 'b1'])
  })

  it('위로 옮기면 그 자리에 끼워지고 사이가 한 칸씩 밀린다', () => {
    expect(moveOcid(순서목록, 3, 1)).toEqual(['a1', 'b1', 'a2', 'a3'])
  })

  it('한 칸 이동은 이웃과 자리를 바꾼 것과 같다', () => {
    expect(moveOcid(순서목록, 1, 2)).toEqual(['a1', 'a3', 'a2', 'b1'])
  })

  // 경계. 첫 행을 더 위로, 끝 행을 더 아래로 보내면 갈 곳이 없다. 던지지 않고 **같은 내용**이다
  // (접근성 액션이 경계에서 그 액션을 아예 안 주는 것과 짝이다. 그래도 값 규칙이 먼저 선다).
  it.each([
    ['첫 행을 위로', 0, -1],
    ['끝 행을 아래로', 3, 4],
    ['한참 위로', 2, -10],
    ['한참 아래로', 1, 99],
  ])('%s 보내면 목록 안으로 잘린다', (_label, from, to) => {
    const moved = moveOcid(순서목록, from, to)

    expect(moved).toHaveLength(순서목록.length)
    expect([...moved].sort()).toEqual([...순서목록].sort())
  })

  it('첫 행을 위로 보내면 순서가 그대로다', () => {
    expect(moveOcid(순서목록, 0, -1)).toEqual(순서목록)
  })

  it('같은 자리면 같은 배열 내용이다', () => {
    expect(moveOcid(순서목록, 2, 2)).toEqual(순서목록)
  })

  it('원본을 건드리지 않는다', () => {
    const before = [...순서목록]

    moveOcid(순서목록, 0, 3)

    expect(순서목록).toEqual(before)
  })

  it('빈 목록에서도 던지지 않는다', () => {
    expect(moveOcid([], 0, 1)).toEqual([])
  })
})

describe('끌기가 그리던 순서와 저장되는 순서가 같다', () => {
  const 짝 = 순서목록.flatMap((_, from) => 순서목록.map((__, to) => [from, to] as const))

  it.each(짝)('%i 번째를 %i 번째로', (from, to) => {
    expect(moveOcid(순서목록, from, to)).toEqual(reorderInsert(순서목록, from, to))
  })
})
