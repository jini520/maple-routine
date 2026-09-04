/**
 * 저장·삭제의 **공통 계약**. 갈래별 폼 셋이 같은 말을 하므로 한 자리에 둔다.
 *
 * **던지면 시트를 지킨다**: 실패해도 안 닫고 저장 중 만 푼다. 무엇이 잘못됐는지는 화면이 띄운
 * 토스트가 말한다. 저장이 도는 동안 다시 못 누르게 막는 것도 여기다. 손입력은 두 번 눌리면
 * 행이 둘이 된다.
 */
import { useState } from 'react'

import type { SpendDraft } from '../app/cashbook/spend/form-shared'

export function useSpendSubmit(props: {
  onSave: (draft: SpendDraft) => void | Promise<void>
  onDelete?: () => void | Promise<void>
  onClose: () => void
}): {
  saving: boolean
  submit: (draft: SpendDraft) => Promise<void>
  remove: () => Promise<void>
} {
  const [saving, setSaving] = useState(false)

  async function submit(draft: SpendDraft): Promise<void> {
    if (saving) return
    setSaving(true)
    try {
      await props.onSave(draft)
    } catch {
      setSaving(false)
      return
    }
    props.onClose()
  }

  async function remove(): Promise<void> {
    if (saving || props.onDelete === undefined) return
    setSaving(true)
    try {
      await props.onDelete()
    } catch {
      setSaving(false)
      return
    }
    props.onClose()
  }

  return { saving, submit, remove }
}
