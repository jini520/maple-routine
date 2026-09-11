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
import { useWorldLeapStore } from '../features/character-manage/world-leap-store'

export interface SelectionDraft {
  selectedOcids: string[]
  representativeOcid: string | null
  /** 저장 활성 조건. 집합 ∪ 순서 ∪ 대표 중 하나라도 다르면 참. */
  isDirty: boolean
  addCharacter: (ocid: string) => void
  /**
   * 목록을 통째로 갈아끼우는 문. 순서 변경·추가·해제가 전부 여기로 들어온다.
   *
   * 격자에게는 그 셋이 같은 재배열이라 **무엇이 남았나** 만 오기 때문이다.
   */
  replaceSelection: (ocids: string[]) => void
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

  // 값이 같으면 **같은 배열을 돌려준다**. 새 배열은 그것을 읽는 곳을 전부 다시 그리게 한다.
  const replaceSelection = useCallback(
    (ocids: string[]): void => {
      editSelection((previous) => (sameOrder(previous, ocids) ? previous : ocids))
    },
    [editSelection],
  )

  const removeCharacter = useCallback(
    (ocid: string): void => {
      editSelection((previous) => previous.filter((candidate) => candidate !== ocid))
    },
    [editSelection],
  )

  /**
   * 저장소에서 그 ocid 가 정리됐다는 사실을 **초안이 이어받는다**(월드 이전 확인).
   *
   * 갈아끼운 것(`to` 가 새 ocid)과 목록에서 뺀 것(`to` 가 `null`)이 같은 문으로 온다. 초안이
   * 할 일이 그 자리를 바꾸느냐 지우느냐로만 갈린다.
   *
   * 사용자의 편집이 아니라 바깥에서 온 사실이라 다른 편집 함수와 성격이 다르다. 그래서 화면이
   * 부르지 않고 이 훅이 스토어를 구독한다. 묻는 모달이 화면 밖(`AppNavigation`)에 살아 이 훅에
   * 손이 닿지 않고, 안 이어받으면 초안이 든 옛 ocid 가 **저장 한 번에 되살아난다**.
   *
   * 셀렉터 훅이 아니라 `subscribe` 인 것은 **바뀌는 순간에만** 해야 하는 일이기 때문이다. 값으로
   * 읽어 이펙트에서 반영하면 마운트할 때도 한 번 도는데, 그때는 `trackedOcids` 가 이미 새 값이라
   * 할 일이 없다. 되려 이 훅이 뒤늦게 마운트되는 경우 이미 적힌 교체를 다시 읽는다.
   *
   * 손대지 않은 초안(`null`)에는 아무것도 안 만든다. `trackedOcids` 가 이미 새 값이라 그대로
   * 보이고, 여기서 초안을 만들면 사용자가 손댄 적 없는데 저장 버튼이 켜진다.
   */
  useEffect(
    () =>
      useWorldLeapStore.subscribe((state, previous) => {
        const resolved = state.resolved
        if (resolved === null || resolved === previous.resolved) {
          return
        }
        // 지역 상수로 푼다. 속성으로 두면 `to === null` 로 좁힌 것이 아래 콜백 안에서 풀린다.
        const { from, to } = resolved
        setEditedOcids((current) => {
          if (current === null || !current.includes(from)) {
            return current
          }
          return to === null
            ? current.filter((ocid) => ocid !== from)
            : current.map((ocid) => (ocid === from ? to : ocid))
        })
        // 고른 대표도 함께 간다. 안 옮기면 `resolveRepresentative` 가 목록에 없는 값으로 읽어
        // 사용자가 방금 찍은 별이 사라진다. 뺀 것이면 `null`(없음으로 고름)이 맞는 값이다. 안
        // 골랐으면(`undefined`) 그대로 둔다.
        setPickedRepresentative((current) => (current === from ? to : current))
      }),
    [],
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
    replaceSelection,
    removeCharacter,
    moveCharacter,
    setRepresentative,
  }
}
