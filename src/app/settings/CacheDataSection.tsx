import { useEffect, useState } from 'react'
import type { CacheDataGroupId, CacheDataSelection } from '../../storage/cache-data'
import { clearCacheData, getCacheDataSizes } from '../../storage/cache-data'
import { setPendingNotice } from '../../storage/pending-notice'
import { closeBossProfitDb } from '../../storage/sqlite/db'
import { showSplashScreen } from '../../native/splash-screen'
import { formatBytes } from '../../lib/format-bytes'
import { SettingsRow } from './SettingsRow'
import { CacheClearConfirm } from './CacheClearConfirm'
import { Card } from '../../components/Card/Card'

const CLEAR_TIMEOUT_MS = 10_000

export interface CacheDataSectionProps {
  // 테스트 주입용 — 기본은 window.location.reload
  reload?: () => void
}

export function CacheDataSection(props: CacheDataSectionProps = {}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [sizes, setSizes] = useState<Record<CacheDataGroupId, number> | null>(null)

  useEffect(() => {
    getCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다(ADR-058 결정 8).
  const totalBytes = sizes === null ? null : sizes.general + sizes.bossRecords

  async function handleClear(selection: CacheDataSelection): Promise<void> {
    setIsClearing(true)
    // 삭제가 실패하거나(reject) 네이티브 호출이 돌아오지 않아도(hang) 모달이 "삭제 중..."에
    // 갇히지 않도록, 타임아웃과 경쟁시킨 뒤 항상 리로드한다.
    //
    // ADR-065 결정 3: 실패를 더는 삼키지 않는다. 다만 리로드가 화면 신호를 파괴하므로 여기서
    // 토스트를 띄울 수 없다 — 플래그를 남기고 부팅 후에 띄운다. 타임아웃(응답 없음)도 삭제됐는지
    // 알 수 없으므로 같이 알린다(타임아웃과 실패를 구분하는 안은 채택하지 않았다).
    const outcome = await Promise.race([
      clearCacheData(selection).then(
        () => 'ok' as const,
        () => 'failed' as const,
      ),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), CLEAR_TIMEOUT_MS)),
    ])
    if (outcome !== 'ok') {
      setPendingNotice('cacheClearFailed')
    }
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

      <Card className="px-6 divide-y divide-border">
        <SettingsRow
          label="캐시 데이터 삭제"
          onClick={() => setIsOpen(true)}
          danger
          // ADR-061 결정 7: 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다(빈 문자열이면
          // 값이 툭 나타나며 행이 밀린다).
          rightContent={
            <span className="text-sm text-text-muted tabular-nums">
              {totalBytes !== null ? formatBytes(totalBytes) : '- KB'}
            </span>
          }
        />
      </Card>

      <CacheClearConfirm
        isOpen={isOpen}
        isClearing={isClearing}
        sizes={sizes}
        onConfirm={(selection) => {
          void handleClear(selection)
        }}
        onCancel={() => setIsOpen(false)}
      />
    </section>
  )
}
