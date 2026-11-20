import { useEffect, useLayoutEffect, useRef } from 'react'

import type { SaveSlot } from './form-shared'

/**
 * 저장 줄을 시트 바닥으로 올린다.
 *
 * **손잡이는 ref 로 넘긴다.** 그 함수는 폼의 모든 값을 물고 있어 렌더마다 새것인데, 그것을 상태로
 * 올리면 매 렌더가 부모 상태를 바꿔 **무한 렌더**가 된다(2026-09-09 실제로 냈다). ref 는 상태가
 * 아니라서 매 렌더 갱신해도 다시 안 돈다.
 *
 * 상태로 올리는 것은 줄이 **그리는 값** 셋뿐이고 전부 원시값이라 바뀔 때만 올라간다.
 */
export function useSaveSlot(setSave: (slot: SaveSlot) => void, slot: SaveSlot): void {
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
      editing: slot.editing,
      canSave: slot.canSave,
      saving: slot.saving,
      onSave: () => latest.current.onSave(),
      onDelete: hasDelete ? () => latest.current.onDelete?.() : undefined,
    })
  }, [setSave, slot.editing, slot.canSave, slot.saving, hasDelete])
}
