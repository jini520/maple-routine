import { useEffect } from 'react'
import packageJson from '../../../package.json'
import { useLiveUpdateStore, type LiveUpdateStatus } from '../../features/live-update/store'
import { MapleSpinner } from '../../components/atoms/MapleSpinner/MapleSpinner'
import { Button } from '../../components/atoms/Button/Button'
import { Card } from '../../components/atoms/Card/Card'

// 설정의 관찰용 섹션 — 현재 실행 번들 버전과 상태를 보여주고 수동 확인을 제공한다(ADR-026/ADR-027).
// 새 버전을 실제로 받고 적용하는 동의 플로우는 UpdatePromptModal이 담당한다.
export function AppUpdateSection(): React.JSX.Element {
  const { currentVersion, status, availableVersion, downloadProgress, channel, loadCurrentVersion, check } =
    useLiveUpdateStore()

  useEffect(() => {
    void loadCurrentVersion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-061 결정 9: 말줄임표는 '...'(마침표 3개)로 통일하고, 대기 문구는 '~하고 있어요'.
  // 여기의 checking/downloading은 버튼 라벨이 따로 상태를 말하므로 상태 칸은 짧게 둔다.
  const statusText: Record<LiveUpdateStatus, string> = {
    idle: '탭하여 확인',
    checking: '확인하고 있어요',
    'up-to-date': '최신입니다',
    'update-available': `새 버전 v${availableVersion} 있음`,
    'store-required': '스토어 업데이트 필요',
    'confirm-cellular': '다운로드 대기',
    downloading: `다운로드 중 ${downloadProgress}%`,
    'ready-to-apply': '업데이트 준비됨',
    'check-error': '확인에 실패했습니다',
    'download-error': '다운로드에 실패했습니다',
    unsupported: '이 플랫폼에서는 지원되지 않습니다',
  }

  const displayedVersion = currentVersion ?? packageJson.version
  const isUnsupported = status === 'unsupported'
  const isBusy = status === 'checking' || status === 'downloading'
  const highlight =
    status === 'check-error' || status === 'download-error'
      ? 'text-sm text-error-ink'
      : status === 'update-available' || status === 'ready-to-apply' || status === 'store-required'
        ? 'text-sm font-medium text-primary-ink'
        : 'text-sm text-text-muted'

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-text-muted">앱 업데이트</h2>

      <Card className="px-6 divide-y divide-border">
        <div className="flex items-center justify-between py-4">
          <span className="text-sm font-medium text-text">현재 버전</span>
          <span className="flex items-center gap-2">
            {channel === 'beta' && (
              <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary-ink">
                beta
              </span>
            )}
            <span className="text-sm text-text-muted">{displayedVersion}</span>
          </span>
        </div>

        <div className="flex items-center justify-between py-4">
          <span className="text-sm font-medium text-text">상태</span>
          <span className={highlight}>{statusText[status]}</span>
        </div>

        {!isUnsupported && (
          <div className="py-4">
            <Button
              variant="primary"
              onClick={() => {
              void check()
              }}
              disabled={isBusy}
              aria-busy={isBusy}
              className="flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {/* ADR-061 결정 5: 네트워크 왕복이라 disabled만으로는 진행 중인지 멈춘 건지
                  구분되지 않는다 — 스피너 + '~중' 라벨로 바꾼다. */}
              {isBusy && <MapleSpinner size={16} />}
              {isBusy ? '확인 중' : '업데이트 확인'}
            </Button>
          </div>
        )}
      </Card>
    </section>
  )
}
