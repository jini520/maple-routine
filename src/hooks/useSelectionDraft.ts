/**
 * 저장 전의 선택 초안. 목록 순서와 대표 하나를 든다. 네트워크를 안 본다.
 *
 * 저장된 목록을 **값으로 받는다**. 스토어를 직접 부르지 않는 것은 그래야 테스트가 그 자리에 값을
 * 넣어 볼 수 있기 때문이다.
 *
 * 지키는 것 셋.
 *
 * ① 편집하기 전에는 저장된 목록이 그대로 보인다(`null` = 아직 손대지 않았다). 늦게 도착하는
 *    `trackedOcids` 를 effect 로 심으면 그 setState 가 effect 본문에 직접 앉는다. 파생이 답이다.
 * ② 대표는 **세 상태**다. `undefined` 는 아직 안 골랐다, `null` 은 없음으로 골랐다, 나머지는 그 값.
 *    둘을 하나로 합치면 사용자가 대표를 비운 것과 아직 안 만진 것이 같아진다.
 * ③ 대표를 지우는 코드가 없다. 목록에서 빠지면 `resolveRepresentative` 가 `null` 로 답한다.
 *
 * @example
 * const draft = useSelectionDraft(trackedOcids)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

import { resolveRepresentative } from '../features/character-manage/derivations'
import { getRepresentativeCharacter } from '../storage/character-selection'

export interface SelectionDraft {
  selectedOcids: string[]
  representativeOcid: string | null
  /** 저장 활성 조건. 집합 ∪ 순서 ∪ 대표 중 하나라도 다르면 참. */
  isDirty: boolean
  addCharacter: (ocid: string) => void
  removeCharacter: (ocid: string) => void
  /** 끌어 놓았을 때·접근성 액션일 때. 둘 다 `moveOcid` 하나를 통과한다. */
  moveCharacter: (fromIndex: number, toIndex: number) => void
  setRepresentative: (ocid: string) => void
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/** 목록 안으로 자른다. 위/아래로 넘겨도 던지지 않는다. */
function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1)
}

/**
 * `from` 번째를 빼서 `to` 번째에 끼운 목록. **놓은 자리가 곧 배열 순서다.**
 *
 * 끌기와 접근성 액션이 이 함수 하나를 부른다. 끌기는 스크린리더로 조작할 수 없어 위로·아래로
 * 옮기기 액션이 짝으로 서는데, 그 둘이 각자 배열을 만들면 언젠가 갈라진다.
 *
 * 경계 밖은 목록 안으로 자르고, 결과가 제자리면 내용이 같은 새 배열이다(호출부가 바뀌었는가 를
 * 배열 내용으로 판정하므로 참조가 아니라 내용이 계약이다. `isDirty` 가 그 값을 본다).
 *
 * ⚠️ 라이브러리가 끌기 중 화면에 그리는 순서(`react-native-sortables` 의 `reorderInsert`)와 **같은
 * 규칙이어야 한다**. 갈리면 놓는 순간 목록이 눈에 보이던 것과 다르게 튄다. 그 둘을 맞대 보는 것이
 * `useSelectionDraft.spec.tsx` 의 마지막 묶음이다.
 *
 * 훅 밖으로 내보내는 것은 화면 테스트가 기대값을 손으로 적지 않고 이 함수로 만들기 때문이다.
 */
export function moveOcid(ocids: string[], from: number, to: number): string[] {
  if (ocids.length === 0) return []

  const source = clampIndex(from, ocids.length)
  const target = clampIndex(to, ocids.length)
  if (source === target) return [...ocids]

  const next = [...ocids]
  const [moved] = next.splice(source, 1)
  next.splice(target, 0, moved)
  return next
}

export function useSelectionDraft(trackedOcids: string[] | null): SelectionDraft {
  const [editedOcids, setEditedOcids] = useState<string[] | null>(null)
  const [pickedRepresentative, setPickedRepresentative] = useState<string | null | undefined>(
    undefined,
  )
  const [storedRepresentative, setStoredRepresentative] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getRepresentativeCharacter()
      .then((ocid) => {
        if (!cancelled) setStoredRepresentative(ocid)
      })
      .catch(() => {
        // 대표는 표식뿐이라 못 읽어도 화면이 성립한다. 아무 별도 안 채워진다.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // `useMemo` 인 것은 값이 비싸서가 아니라 이 배열을 deps 로 받는 쪽이 매 렌더 갈리지 않게
  // 하기 위해서다(`??` 는 같은 내용이라도 새 배열을 만든다).
  const selectedOcids = useMemo(() => editedOcids ?? trackedOcids ?? [], [editedOcids, trackedOcids])

  const representativeState =
    pickedRepresentative === undefined ? storedRepresentative : pickedRepresentative
  const representativeOcid = resolveRepresentative(selectedOcids, representativeState)

  const isDirty =
    !sameOrder(selectedOcids, trackedOcids ?? []) || representativeOcid !== storedRepresentative

  const editSelection = useCallback(
    (change: (previous: string[]) => string[]): void => {
      setEditedOcids((previous) => change(previous ?? trackedOcids ?? []))
    },
    [trackedOcids],
  )

  // 새로 고른 캐릭터는 **배열 끝**이다(레벨로 끼워 넣지 않는다).
  const addCharacter = useCallback(
    (ocid: string): void => {
      editSelection((previous) => (previous.includes(ocid) ? previous : [...previous, ocid]))
    },
    [editSelection],
  )

  const removeCharacter = useCallback(
    (ocid: string): void => {
      editSelection((previous) => previous.filter((candidate) => candidate !== ocid))
    },
    [editSelection],
  )

  // 놓은 자리가 곧 배열 순서다. 저장 시점에 다시 정렬하지 않는다. 레벨 내림차순은 아직 순서를
  // 정하지 않았을 때의 초기값이다.
  const moveCharacter = useCallback(
    (fromIndex: number, toIndex: number): void => {
      editSelection((previous) => moveOcid(previous, fromIndex, toIndex))
    },
    [editSelection],
  )

  // 라디오다. 채워진 별을 다시 눌러도 같은 값이라 바뀌는 것이 없다.
  const setRepresentative = useCallback((ocid: string): void => {
    setPickedRepresentative(ocid)
  }, [])

  return {
    selectedOcids,
    representativeOcid,
    isDirty,
    addCharacter,
    removeCharacter,
    moveCharacter,
    setRepresentative,
  }
}
