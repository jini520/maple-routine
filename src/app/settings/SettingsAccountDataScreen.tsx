import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { CacheDataSelection } from '../../storage/cache-data'
import type { CacheDataSizes } from '../../features/settings/cache-data'
import { clearCacheDataAndReload, loadCacheDataSizes } from '../../features/settings/cache-data'
import { useSettingsStore } from '../../features/settings/store'
import { formatBytes } from '../../lib/format-bytes'
import { useScreenNavigate } from '../../lib/use-screen-navigate'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { Card } from '../../components/atoms/Card/Card'
import { SettingsRow } from './SettingsRow'
import { AccountModal } from './AccountModal'
import { CacheClearConfirm } from './CacheClearConfirm'
import { DisconnectConfirm } from './DisconnectConfirm'

export interface SettingsAccountDataScreenProps {
  // 테스트 주입용 — 기본은 window.location.reload
  reload?: () => void
}

// 설정 하위 페이지 「계정 및 데이터」(ADR-118 결정 2·3) — 계정 변경 + 파괴적 행 둘.
//
// 골격은 새로 만들지 않고 `/boss/manage`·`/content/manage`·`/settings/about` 과 같은 것을 쓴다
// (ADR-035 결정 18): 공용 `ScreenScroll` + `PageHeader`(fixed + 실측 spacer) + `useScreenNavigate`.
//
// **파괴적 행 둘이 별도 카드로 내려온 것이 이 화면의 요점이다**(이슈 #135). 본화면에서 빼는
// 것만으로는 분리가 아니다 — 옮긴 곳에서 다시 `계정 변경` 과 붙으면 같은 문제가 한 층 내려갈
// 뿐이다. 아래 카드에 제목을 달지 않는 이유는 위험 색 라벨 둘과 카드 경계가 이미 그 말을 하고
// 있어서다(ADR-118 결정 3).
export function SettingsAccountDataScreen(
  props: SettingsAccountDataScreenProps = {},
): React.JSX.Element {
  const { disconnect } = useSettingsStore()
  // 화면을 통째로 바꾸는 이동은 이동 전에 스크롤을 최상단으로 옮긴다(ADR-098 결정 1).
  const navigateToScreen = useScreenNavigate()

  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isCacheClearOpen, setIsCacheClearOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

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

  async function handleDisconnectConfirm(): Promise<void> {
    setIsDisconnecting(true)
    await disconnect()
  }

  return (
    <>
      <ScreenScroll>
        <PageHeader>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateToScreen('/settings')}
              aria-label="뒤로"
              className="p-1 -ml-1 text-text-muted hover:text-text"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <h1 className="text-lg font-semibold text-text">계정 및 데이터</h1>
          </div>
        </PageHeader>

        <div className="space-y-4 px-4 pb-4">
          <Card className="px-6">
            {/* ADR-118 결정 6: 우측에 현재값을 두지 않는다 — `accountId` 는 불투명 문자열이고
                대표 캐릭터 이름은 파생·변동값이다(429·조회 불가에서는 아예 없다). 확실하지 않은
                것을 단정해 보여주느니 chevron 만 둔다. */}
            <SettingsRow label="계정 변경" onClick={() => setIsAccountOpen(true)} />
          </Card>

          <Card className="px-6 divide-y divide-border">
            <SettingsRow
              label="캐시 데이터 삭제"
              onClick={() => setIsCacheClearOpen(true)}
              danger
              showChevron={false}
              // ADR-061 결정 7: 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다(빈 문자열이면
              // 값이 툭 나타나며 행이 밀린다).
              rightContent={
                <span className="text-sm text-text-muted tabular-nums">
                  {totalBytes !== null ? formatBytes(totalBytes) : '- KB'}
                </span>
              }
            />
            <SettingsRow
              label="연결 해제"
              onClick={() => setIsDisconnectOpen(true)}
              danger
              showChevron={false}
            />
          </Card>
        </div>
      </ScreenScroll>

      {/* 모달은 카드 밖이자 셸 밖의 형제다 — 카드 안에 두면 `divide-y` 가 형제로 잡아 구분선이
          하나 더 그려지고, `ScreenScroll` 안에 두면 그 `fixed` 셸이 만든 스태킹 컨텍스트에 갇혀
          오버레이가 탭바 아래로 그려진다(ScreenScroll 주석). */}
      {isAccountOpen && <AccountModal onClose={() => setIsAccountOpen(false)} />}

      <CacheClearConfirm
        isOpen={isCacheClearOpen}
        isClearing={isClearing}
        sizes={sizes}
        onConfirm={(selection) => {
          void handleClear(selection)
        }}
        onCancel={() => setIsCacheClearOpen(false)}
      />

      <DisconnectConfirm
        isOpen={isDisconnectOpen}
        isDisconnecting={isDisconnecting}
        onConfirm={() => {
          void handleDisconnectConfirm()
        }}
        onCancel={() => setIsDisconnectOpen(false)}
      />
    </>
  )
}
