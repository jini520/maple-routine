import { useEffect, useState } from 'react'
import { clearCacheData, getCacheDataSize } from '../../storage/cache-data'
import { closeBossProfitDb } from '../../storage/sqlite/db'
import { showSplashScreen } from '../../native/splash-screen'
import { formatBytes } from '../../lib/format-bytes'
import { SettingsRow } from './SettingsRow'
import { CacheClearConfirm } from './CacheClearConfirm'

const CLEAR_TIMEOUT_MS = 10_000

export interface CacheDataSectionProps {
  // 테스트 주입용 — 기본은 window.location.reload
  reload?: () => void
}

export function CacheDataSection(props: CacheDataSectionProps = {}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [sizeBytes, setSizeBytes] = useState<number | null>(null)

  useEffect(() => {
    getCacheDataSize()
      .then(setSizeBytes)
      .catch(() => {})
  }, [])

  async function handleClear(): Promise<void> {
    setIsClearing(true)
    // 삭제가 실패하거나(reject) 네이티브 호출이 돌아오지 않아도(hang) 모달이 "삭제 중..."에
    // 갇히지 않도록, 실패는 삼키고 타임아웃과 경쟁시킨 뒤 항상 리로드한다.
    await Promise.race([
      clearCacheData().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, CLEAR_TIMEOUT_MS)),
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
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-text-muted">데이터 관리</h2>

      <div className="rounded-[14px] bg-surface border border-border px-6 divide-y divide-border">
        <SettingsRow
          label="캐시 데이터 삭제"
          onClick={() => setIsOpen(true)}
          danger
          rightContent={
            <span className="text-sm text-text-muted">{sizeBytes !== null ? formatBytes(sizeBytes) : ''}</span>
          }
        />
      </div>

      <CacheClearConfirm
        isOpen={isOpen}
        isClearing={isClearing}
        onConfirm={() => {
          void handleClear()
        }}
        onCancel={() => setIsOpen(false)}
      />
    </section>
  )
}
