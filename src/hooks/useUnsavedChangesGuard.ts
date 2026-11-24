/**
 * 저장하지 않은 초안을 지키는 확인 창과 저장 상태. 보스 관리 · 컨텐츠 관리가 쓴다.
 *
 * 이 화면을 스택에서 빼는 이동(`←` · iOS 가장자리 스와이프 · 안드로이드 뒤로 가기 · 다른 탭 열기)은 `usePreventRemove` 한 곳에서
 * 막는다. 이동마다 따로 막으면 새 이동이 생길 때 빠진다. 화면 안의 캐릭터 바꾸기는 `confirm` 으로 같은 창을 띄운다.
 *
 * @example
 * const guard = useUnsavedChangesGuard({ dirty, save, discard })
 * {guard.dialog !== null && <NoticeModal {...guard.dialog} />}
 */
import { useState } from 'react'
import { usePreventRemove } from '@react-navigation/native'

import type { NoticeModalProps } from '../components/organisms/NoticeModal/NoticeModal'
import { useScreenNavigation } from './useScreenNavigation'

/** 저장의 결과. 실패면 그 문구를 띄우는 함수를 든다. 확인 창에서 저장했으면 창을 닫은 뒤에 불러야 토스트가 창 뒤에 가리지 않는다. */
export type DraftSaveOutcome = { saved: true } | { saved: false; report: () => void }

export interface UnsavedChangesGuard {
  /** 저장하는 중인가. 아래 `저장` 과 창의 `저장` 이 함께 본다 */
  saving: boolean
  /** 아래 `저장`. */
  save: () => void
  /** 화면 안의 이동. 바꾼 것이 있으면 창을 띄우고, 없으면 바로 잇는다 */
  confirm: (proceed: () => void) => void
  /** 확인 창. 막아 둔 이동이 없으면 `null` 이다 */
  dialog: NoticeModalProps | null
}

export function useUnsavedChangesGuard(options: {
  dirty: boolean
  save: () => Promise<DraftSaveOutcome>
  /** 초안을 버리는 함수 */
  discard: () => void
}): UnsavedChangesGuard {
  const navigation = useScreenNavigation()
  const [saving, setSaving] = useState(false)
  // 창을 띄우게 한 이동. 저장이나 버리기를 고르면 잇는다.
  const [blocked, setBlocked] = useState<{ proceed: () => void } | null>(null)

  usePreventRemove(options.dirty, ({ data }) => {
    setBlocked({ proceed: () => navigation.dispatch(data.action) })
  })

  async function runSave(): Promise<DraftSaveOutcome> {
    setSaving(true)
    try {
      return await options.save()
    } finally {
      setSaving(false)
    }
  }

  async function saveThenProceed(target: { proceed: () => void }): Promise<void> {
    const outcome = await runSave()
    setBlocked(null)
    // 실패한 채 이동하면 바꾼 것이 말없이 사라진다. 그 화면과 그 캐릭터에 남는다.
    if (outcome.saved) target.proceed()
    else outcome.report()
  }

  return {
    saving,
    save() {
      void runSave().then((outcome) => {
        if (!outcome.saved) outcome.report()
      })
    },
    confirm(proceed) {
      if (options.dirty) setBlocked({ proceed })
      else proceed()
    },
    dialog:
      blocked === null
        ? null
        : {
            testId: 'unsaved-changes',
            tone: 'primary',
            title: '저장하지 않은 변경이 있어요',
            description: '바꾼 내용을 저장할까요?',
            // 바꾼 것을 지키는 쪽이 안전한 기본값이라 큰 버튼이다.
            action: { label: '저장', busy: saving, disabled: saving, onPress: () => void saveThenProceed(blocked) },
            secondaryAction: {
              label: '버리기',
              danger: true,
              disabled: saving,
              onPress: () => {
                options.discard()
                setBlocked(null)
                blocked.proceed()
              },
            },
            // 두 버튼 중 아무것도 고르지 않았으니 아무것도 하지 않는다.
            onClose: () => {
              if (!saving) setBlocked(null)
            },
          },
  }
}
