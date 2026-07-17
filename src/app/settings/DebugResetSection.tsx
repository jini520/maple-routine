import { useState } from 'react'
import { clearAppDataExceptAuth } from '../../storage/debug-reset'
import { closeBossProfitDb } from '../../storage/sqlite/db'
import { showSplashScreen } from '../../native/splash-screen'
import { SettingsRow } from './SettingsRow'
import { DebugResetConfirm } from './DebugResetConfirm'

// 임시 디버그 — 데이터 초기화 섹션(자기완결). 상태·핸들러·확인 모달을 모두 이 안에 담아 프로덕션
// 코드(SettingsScreen)와 분리한다. 배포 전 이 파일 · debug-reset.ts · DebugResetConfirm.tsx를 지우고
// SettingsScreen의 <DebugResetSection/> 한 줄만 제거하면 프로덕션에서 완전히 사라진다.
const RESET_TIMEOUT_MS = 10_000

export interface DebugResetSectionProps {
  // 테스트 주입용 — 기본은 window.location.reload
  reload?: () => void
}

export function DebugResetSection(props: DebugResetSectionProps = {}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  async function handleReset(): Promise<void> {
    setIsResetting(true)
    // 삭제가 실패하거나(reject) 네이티브 호출이 돌아오지 않아도(hang) 모달이 "초기화 중..."에
    // 갇히지 않도록, 실패는 삼키고 타임아웃과 경쟁시킨 뒤 항상 리로드한다 — 디버그 도구는
    // best-effort로 충분하다(Preferences는 이미 지워졌고, SQLite는 다음 시도에서 재시도된다).
    await Promise.race([
      clearAppDataExceptAuth().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, RESET_TIMEOUT_MS)),
    ])
    // 리로드 동안 웹뷰 네이티브 배경색(브랜드 주황)이 깜빡 드러나므로, 앱 실행 때처럼 스플래시로
    // 덮고 리로드한다 — 리로드된 앱의 부팅 흐름이 스플래시를 내린다. 실패해도 리로드는 진행.
    await showSplashScreen().catch(() => {})
    // 리로드가 JS 컨텍스트를 파괴하기 전에 SQLite 커넥션을 먼저 정상 종료한다 — 안 그러면
    // OTA 적용(native/live-update.ts)과 같은 이유로 네이티브 쪽에 stale 커넥션이 남아, 리로드
    // 후 보스 수익 과거 기간 조회가 "이 기간을 불러오지 못했습니다"로 실패한다(사용자 보고).
    await closeBossProfitDb()
    ;(props.reload ?? (() => window.location.reload()))()
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
