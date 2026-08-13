import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CloudDownload,
  Info,
  Signal,
  Sparkles,
  Store,
} from 'lucide-react'
import { Modal } from '../components/organisms/Modal/Modal'
import { useLiveUpdateStore, type LiveUpdateStatus } from '@core/features/live-update/store'
import { ProgressBar } from '../components/atoms/ProgressBar/ProgressBar'
import { MapleSweepSpinner } from '../components/atoms/MapleSweepSpinner/MapleSweepSpinner'
import { Badge } from '../components/atoms/Badge/Badge'

// 사용자 동의형 업데이트 모달 — 실행 시(또는 설정에서 수동 확인 시) 새 버전이 있으면 뜬다(ADR-027).
const MODAL_STATUSES: ReadonlySet<LiveUpdateStatus> = new Set([
  'update-available',
  'confirm-cellular',
  'downloading',
  'ready-to-apply',
  'store-required',
  // ADR-065 결정 2: 사용자가 시작한 다운로드의 실패만 모달로 알린다. 매니페스트 조회 실패
  // ('check-error')는 자동 확인일 수 있어 여기 넣지 않는다 — 설정 상태 행에만 남는다.
  'download-error',
  // ADR-117 결정 7: 둘 다 사용자가 [지금 적용]을 눌러 시작한 흐름이라 위 분류를 그대로 따른다.
  // 'applying'은 커버가 닫기 뒤로 밀린 구간(최대 5초)의 정직한 피드백이고, 'apply-error'는
  // 그 흐름의 실패라 download-error 와 같은 층이다.
  'applying',
  'apply-error',
  // ADR-126 결정 4: 적용·재시작이 끝난 직후 1회. 부팅 때 뒤늦게 판정되는 유일한 상태다.
  'updated',
])

// 개발 노트 화면([[ADR-119]] · [[ADR-125]]) — 적용이 끝난 뒤에야 이 목록에 새 버전이 있다.
const RELEASE_NOTES_PATH = '/settings/release-notes'

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const PRIMARY_BTN =
  'w-full rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover px-5 py-2.5 text-sm disabled:opacity-50'
// ADR-065 결정 2: 부 동작이 주 동작과 같은 크기(px-5 py-2.5 text-sm)라 비중이 너무 컸다.
// 이 상수를 4개 분기가 공유하므로 줄이면 모달 전체에 함께 적용된다 — 한 모달 안에서 부 동작
// 크기가 갈리지 않게 하려는 의도다.
const GHOST_BTN = 'w-full rounded-full px-4 py-1.5 text-xs font-medium text-text-muted hover:text-text'

type IconTone = 'primary' | 'secondary' | 'third' | 'error'
const TONE_CLASSES: Record<IconTone, string> = {
  primary: 'bg-primary-tint text-primary-ink',
  secondary: 'bg-secondary-tint text-secondary-ink',
  third: 'bg-third-tint text-third-ink',
  error: 'bg-error-tint text-error-ink',
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
  return <Badge tone="primary">beta</Badge>
}

// info-tint 정보 콜아웃 — 부가 정보(용량, 최소 앱 버전 등)를 본문 문장과 분리해 보여준다(ADR-027).
function InfoNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-info-tint px-3.5 py-2.5 text-left">
      <Info className="h-4 w-4 shrink-0 text-info-ink" strokeWidth={2} aria-hidden="true" />
      <span className="text-xs font-medium text-text">{children}</span>
    </div>
  )
}

// 받기 전 모달의 「자세히 보기」 — 원격에서 온 핵심 목록을 **모달 안에서** 펼친다(ADR-126 결정 1).
// 화면을 옮기지 않는 이유는 모달을 닫아야 하고 돌아왔을 때 다시 띄우는 처리가 필요한데, 정작 그
// 화면(개발 노트)에는 아직 받지 않은 이 버전이 **없기** 때문이다.
function HighlightsDisclosure({ highlights }: { highlights: string[] }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={`${GHOST_BTN} flex items-center justify-center gap-1`}
      >
        자세히 보기
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <ul className="space-y-1.5 rounded-[10px] bg-info-tint px-3.5 py-2.5 text-left">
          {highlights.map((line) => (
            <li key={line} className="flex gap-2 text-xs font-medium text-text">
              <span aria-hidden="true" className="text-text-muted">
                ·
              </span>
              <span className="min-w-0 flex-1">{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function UpdatePromptModal(): React.JSX.Element | null {
  const {
    status,
    currentVersion,
    availableVersion,
    availableSize,
    availableHighlights,
    minNativeVersion,
    downloadProgress,
    channel,
    startDownload,
    confirmCellularDownload,
    apply,
    openStore,
    dismiss,
  } = useLiveUpdateStore()
  const navigate = useNavigate()

  if (!MODAL_STATUSES.has(status)) return null

  // 다운로드·적용이 도는 동안은 되돌릴 수 없거나 되돌리면 안 되는 구간이다.
  const isInProgress = status === 'downloading' || status === 'applying'
  const sizeText = availableSize !== null ? formatSize(availableSize) : ''

  // 받은 뒤의 「자세히 보기」 — 여기서는 펼치지 않고 **전부 갖고 있는 화면으로 보낸다**(결정 1).
  // 닫지 않으면 돌아왔을 때 같은 안내가 그대로 덮여 있다.
  const openReleaseNotes = (): void => {
    dismiss()
    navigate(RELEASE_NOTES_PATH)
  }

  return (
    // 진행 중에는 배경 탭으로 닫히지 않게 한다(진행 중 취소 방지). 폭은 살짝 좁게(max-w-xs).
    // 입력이 없어 키보드를 띄우지 않으므로 중앙에 그대로 둔다 — 다른 모달은 상단 정렬이 기본이다.
    <Modal
      onClose={isInProgress ? () => {} : dismiss}
      testId="update-prompt-overlay"
      align="center"
    >
      <Modal.Card maxWidth="max-w-xs" tight>
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
              {/* ADR-126 결정 6: 없으면 **버튼째 그리지 않는다.** 옛 매니페스트에는 이 필드가 없고
                  그것은 오류가 아니라 안 실려 온 것이라, 액션 없는 비활성 버튼을 두지 않는다. */}
              {availableHighlights !== null && <HighlightsDisclosure highlights={availableHighlights} />}
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
              {/* ADR-061 결정 6: 결정형 진행률은 예외 없이 h-1.5 프리미티브 하나 — 이 모달만
                  쓰던 h-2 변형을 없앤다. */}
              <ProgressBar percent={downloadProgress} animated fillTestId="update-progress-bar" />
              <p className="text-xs font-medium text-text-muted tabular-nums">{downloadProgress}%</p>
            </div>
          )}

          {/* ADR-117 결정 7: 커버가 닫기 뒤로 밀린 구간(최대 5초). 적용은 퍼센트가 나오지 않아
              결정형 진행률을 쓰지 않고(가짜로 채우면 거짓 정보다) 모달 안 대기의 규격대로
              스윕 스피너 + 문구만 둔다(ADR-061 결정 1·2). 버튼은 두지 않는다 — 되돌릴 수 없는
              구간이고, dismiss 가 downloadedBundleId 를 비우면 재시도할 번들 참조를 잃는다. */}
          {status === 'applying' && (
            <div className="space-y-3" role="status" aria-busy="true">
              <MapleSweepSpinner size={32} className="mx-auto text-primary" />
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-text">적용하고 있어요</h2>
                <p className="text-xs text-text-muted">잠시 뒤 앱이 다시 시작돼요.</p>
              </div>
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

          {/* ADR-126 결정 4: 적용 성공 경로에는 상태 전환 코드가 없으므로(ADR-117 결정 1) 이 안내는
              **재시작 뒤 부팅에서** 뜬다. 여기서만 「자세히 보기」가 화면을 옮긴다 — 이 시점에야
              새 버전 노트가 앱 안에 있고, 흐름이 이미 끝나 옮겨도 끊을 것이 없다. */}
          {status === 'updated' && (
            <>
              <IconBadge icon={Sparkles} tone="primary" />
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-text">업데이트를 마쳤어요</h2>
                <div className="flex items-center justify-center">
                  <VersionBadge version={currentVersion} />
                </div>
                <p className="text-xs text-text-muted">새 버전으로 다시 시작했어요.</p>
              </div>
              <div className="space-y-1">
                <button type="button" onClick={dismiss} className={PRIMARY_BTN}>
                  확인
                </button>
                <button type="button" onClick={openReleaseNotes} className={GHOST_BTN}>
                  자세히 보기
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
          {status === 'download-error' && (
            <>
              <IconBadge icon={AlertTriangle} tone="error" />
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-text">업데이트를 받지 못했습니다</h2>
                <p className="text-sm text-text-muted">네트워크 연결을 확인한 뒤 다시 시도해주세요.</p>
              </div>
              <div className="space-y-1">
                <button type="button" onClick={() => void startDownload()} className={PRIMARY_BTN}>
                  다시 시도
                </button>
                <button type="button" onClick={dismiss} className={GHOST_BTN}>
                  나중에
                </button>
              </div>
            </>
          )}

          {/* ADR-117 결정 1: 적용이 실패·타임아웃해도 화면은 돌아온다. download-error 와 같은
              골격이되 주 동작이 다르다 — 받아둔 번들이 그대로 살아 있어 다시 받지 않고 apply()
              만 다시 부른다(스토어가 downloadedBundleId 를 비우지 않는다). */}
          {status === 'apply-error' && (
            <>
              <IconBadge icon={AlertTriangle} tone="error" />
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-text">업데이트를 적용하지 못했습니다</h2>
                <p className="text-sm text-text-muted">
                  받아둔 파일은 그대로 있습니다. 다시 받지 않고 적용만 다시 시도합니다.
                </p>
              </div>
              <div className="space-y-1">
                <button type="button" onClick={() => void apply()} className={PRIMARY_BTN}>
                  다시 시도
                </button>
                <button type="button" onClick={dismiss} className={GHOST_BTN}>
                  나중에
                </button>
              </div>
            </>
          )}

        </div>
      </Modal.Card>
    </Modal>
  )
}
