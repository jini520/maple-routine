import { useEffect, useState } from 'react'
import type { CacheDataSelection } from '../../storage/cache-data'
import type { CacheDataSizes } from '../../features/settings/cache-data'
import { clearCacheDataAndReload, loadCacheDataSizes } from '../../features/settings/cache-data'
import { formatBytes } from '../../lib/format-bytes'
import { SettingsRow } from './SettingsRow'
import { CacheClearConfirm } from './CacheClearConfirm'
import { Card } from '../../components/Card/Card'

export interface CacheDataSectionProps {
  // 테스트 주입용 — 기본은 window.location.reload
  reload?: () => void
}

export function CacheDataSection(props: CacheDataSectionProps = {}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)

  useEffect(() => {
    loadCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다(ADR-058 결정 8).
  const totalBytes = sizes === null ? null : sizes.general + sizes.bossRecords

  async function handleClear(selection: CacheDataSelection): Promise<void> {
    setIsClearing(true)
    await clearCacheDataAndReload(selection, props.reload ?? (() => window.location.reload()))
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
