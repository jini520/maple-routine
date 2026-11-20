import { useEffect, useLayoutEffect, useRef } from 'react'

import type { SpendHeaderSlot, SpendSaveSlot } from './form-shared'

/**
 * 저장 줄의 값을 시트로 올리는 훅. 수입 시트와 **같은 계약**이다.
 *
 * 콜백은 **최신 것을 ref 로 부른다**. 값째로 의존성에 넣으면 렌더마다 새 함수라 매번 다시
 * 올라가고, 그때마다 바닥 줄이 새로 그려진다.
 */
export function useSaveSlot(setSave: (slot: SpendSaveSlot) => void, slot: SpendSaveSlot): void {
  const latest = useRef(slot)
  useEffect(() => {
    latest.current = slot
  })

  const hasDelete = slot.onDelete !== undefined
  /*
    **그리기 전에 올린다.** 평범한 `useEffect` 로 올리면 시트가 한 프레임 동안 바닥 줄 없이
    그려진다. 그 프레임에는 줄이 설 자리도 안 비어 있어, 단계를 옮기는 순간 시트 아래쪽이
    통째로 빈 칸으로 보인다(사용자 보고).
  */
  useLayoutEffect(() => {
    setSave({
      showSave: slot.showSave,
      editing: slot.editing,
      canSave: slot.canSave,
      saving: slot.saving,
      onSave: () => latest.current.onSave(),
      onDelete: hasDelete ? () => latest.current.onDelete?.() : undefined,
    })
  }, [setSave, slot.showSave, slot.editing, slot.canSave, slot.saving, hasDelete])
}

/**
 * 머리를 시트로 올린다. `useSaveSlot` 과 같은 이유로 **그리기 전에** 올린다.
 *
 * 평범한 `useEffect` 로 올리면 시트가 한 프레임 동안 머리 없이 그려지고, 그 프레임에는 머리가
 * 설 자리도 안 비어 있어 내용이 위로 튀어 올랐다 내려온다.
 */
export function useHeaderSlot(
  setHeader: (slot: SpendHeaderSlot) => void,
  slot: SpendHeaderSlot,
): void {
  const latest = useRef(slot)
  useEffect(() => {
    latest.current = slot
  })

  const hasBack = slot.onBack !== undefined

  useLayoutEffect(() => {
    setHeader({
      title: slot.title,
      dateKey: slot.dateKey,
      todayDateKey: slot.todayDateKey,
      earliestDateKey: slot.earliestDateKey,
      onDateChange: (next) => latest.current.onDateChange(next),
      onBack: hasBack ? () => latest.current.onBack?.() : undefined,
    })
  }, [setHeader, slot.title, slot.dateKey, slot.todayDateKey, slot.earliestDateKey, hasBack])
}
