import { CheckCircle2, CloudDownload, Info, Signal, Store } from 'lucide-react'
import { Modal } from '../components/Modal/Modal'
import { useLiveUpdateStore, type LiveUpdateStatus } from '../features/live-update/store'

// 사용자 동의형 업데이트 모달 — 실행 시(또는 설정에서 수동 확인 시) 새 버전이 있으면 뜬다(ADR-027).
const MODAL_STATUSES: ReadonlySet<LiveUpdateStatus> = new Set([
  'update-available',
  'confirm-cellular',
  'downloading',
  'ready-to-apply',
  'store-required',
])

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const PRIMARY_BTN =
  'w-full rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 text-sm disabled:opacity-50'
const GHOST_BTN = 'w-full rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text'

type IconTone = 'primary' | 'secondary' | 'third'
const TONE_CLASSES: Record<IconTone, string> = {
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/20 text-secondary-text',
  third: 'bg-third/20 text-third-text',
}

function IconBadge({ icon: Icon, tone }: { icon: typeof CloudDownload; tone: IconTone }): React.JSX.Element {
  return (
    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}>
      <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
    </div>
  )
}

function VersionBadge({ version }: { version: string | null }): React.JSX.Element {
  return (
    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-text-muted tabular-nums">
      v{version}
    </span>
  )
}

function BetaBadge(): React.JSX.Element {
  return <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">beta</span>
}

// info-tint 정보 콜아웃 — 부가 정보(용량, 최소 앱 버전 등)를 본문 문장과 분리해 보여준다(ADR-027).
function InfoNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-info-tint px-3.5 py-2.5 text-left">
      <Info className="h-4 w-4 shrink-0 text-secondary-text" strokeWidth={2} aria-hidden="true" />
      <span className="text-xs font-medium text-text">{children}</span>
    </div>
  )
}

export function UpdatePromptModal(): React.JSX.Element | null {
  const {
    status,
    availableVersion,
    availableSize,
    minNativeVersion,
    downloadProgress,
    channel,
    startDownload,
    confirmCellularDownload,
    apply,
    openStore,
    dismiss,
  } = useLiveUpdateStore()

  if (!MODAL_STATUSES.has(status)) return null

  const isDownloading = status === 'downloading'
  const sizeText = availableSize !== null ? formatSize(availableSize) : ''

  return (
    // 다운로드 중에는 배경 탭으로 닫히지 않게 한다(진행 중 취소 방지). 폭은 살짝 좁게(max-w-xs).
    // 입력이 없어 키보드를 띄우지 않으므로 중앙에 그대로 둔다 — 다른 모달은 상단 정렬이 기본이다.
    <Modal
      onClose={isDownloading ? () => {} : dismiss}
      testId="update-prompt-overlay"
      maxWidth="max-w-xs"
      align="center"
    >
      <div className="space-y-5 text-center">
        {status === 'update-available' && (
          <>
            <IconBadge icon={CloudDownload} tone="primary" />
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text">새 업데이트가 있어요</h2>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {channel === 'beta' && <BetaBadge />}
                <VersionBadge version={availableVersion} />
              </div>
              <p className="text-xs text-text-muted">다운로드 크기 {sizeText}</p>
            </div>
            <div className="space-y-1">
              <button type="button" onClick={() => void startDownload()} className={PRIMARY_BTN}>
                다운로드
              </button>
              <button type="button" onClick={dismiss} className={GHOST_BTN}>
                나중에
              </button>
            </div>
          </>
        )}

        {status === 'confirm-cellular' && (
          <>
            <IconBadge icon={Signal} tone="secondary" />
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text">모바일 데이터를 사용해요</h2>
              <p className="text-sm text-text-muted">Wi-Fi가 아니에요. 데이터로 받으면 요금이 나올 수 있어요.</p>
              <InfoNote>다운로드 크기 {sizeText}</InfoNote>
            </div>
            <div className="space-y-1">
              <button type="button" onClick={() => void confirmCellularDownload()} className={PRIMARY_BTN}>
                계속
              </button>
              <button type="button" onClick={dismiss} className={GHOST_BTN}>
                취소
              </button>
            </div>
          </>
        )}

        {status === 'downloading' && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-text">다운로드 중</h2>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                data-testid="update-progress-bar"
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-xs font-medium text-text-muted tabular-nums">{downloadProgress}%</p>
          </div>
        )}

        {status === 'ready-to-apply' && (
          <>
            <IconBadge icon={CheckCircle2} tone="secondary" />
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text">업데이트 준비 완료</h2>
              <div className="flex items-center justify-center">
                <VersionBadge version={availableVersion} />
              </div>
              <p className="text-xs text-text-muted">지금 적용하려면 앱을 재시작해요.</p>
            </div>
            <div className="space-y-1">
              <button type="button" onClick={() => void apply()} className={PRIMARY_BTN}>
                지금 적용 (재시작)
              </button>
              <button type="button" onClick={dismiss} className={GHOST_BTN}>
                나중에
              </button>
            </div>
          </>
        )}

        {status === 'store-required' && (
          <>
            <IconBadge icon={Store} tone="third" />
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text">스토어 업데이트가 필요해요</h2>
              <div className="flex items-center justify-center">
                <VersionBadge version={availableVersion} />
              </div>
              <p className="text-sm text-text-muted">이 업데이트는 앱 스토어에서 업데이트해야 받을 수 있어요.</p>
              {minNativeVersion && (
                <InfoNote>
                  최소 앱 버전 <span className="font-semibold tabular-nums">{minNativeVersion}</span> 이상 필요
                </InfoNote>
              )}
            </div>
            <div className="space-y-1">
              <button type="button" onClick={openStore} className={PRIMARY_BTN}>
                스토어로 이동
              </button>
              <button type="button" onClick={dismiss} className={GHOST_BTN}>
                나중에
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
