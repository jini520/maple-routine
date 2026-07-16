import { useState } from 'react'
import { clearAppDataExceptAuth } from '../../storage/debug-reset'
import { SettingsRow } from './SettingsRow'
import { DebugResetConfirm } from './DebugResetConfirm'

// 임시 디버그 — 데이터 초기화 섹션(자기완결). 상태·핸들러·확인 모달을 모두 이 안에 담아 프로덕션
// 코드(SettingsScreen)와 분리한다. 배포 전 이 파일 · debug-reset.ts · DebugResetConfirm.tsx를 지우고
// SettingsScreen의 <DebugResetSection/> 한 줄만 제거하면 프로덕션에서 완전히 사라진다.
export function DebugResetSection(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  async function handleReset(): Promise<void> {
    setIsResetting(true)
    await clearAppDataExceptAuth()
    window.location.reload()
  }

  return (
    <>
      <div className="rounded-[14px] bg-surface border border-dashed border-border px-6 divide-y divide-border">
        <SettingsRow
          label="🧹 디버그: 데이터 초기화"
          onClick={() => setIsOpen(true)}
          showChevron={false}
        />
      </div>

      <DebugResetConfirm
        isOpen={isOpen}
        isResetting={isResetting}
        onConfirm={() => {
          void handleReset()
        }}
        onCancel={() => setIsOpen(false)}
      />
    </>
  )
}
