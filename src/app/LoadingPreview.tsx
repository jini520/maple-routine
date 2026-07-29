import { useEffect, useId, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { MAPLE_LEAF_PATH } from '../components/mapleLeafPath'
import { useThemeStore } from '../features/theme/store'
import type { ThemeName } from '../types/theme'

// 임시 디버그 화면 — [[ADR-061]](로딩 표현 통일)의 시안 비교용.
//
// 1차 선택(2026-07-30, 잠정): S1=B(스피너+라벨 병기) · S2=A(스피너+문구) · S3=A(현행 유지)
// · S5=B(전부 얇은 바) · S6=A(h-1.5 통일) · S8='- KB' 자리표시.
// S4(백필)·S7(모달 차단)은 "새로 디자인"으로 남았고, S9는 "'~중...'은 새로고침 옆 '조회 중...'만
// 남기고 전부 제거"가 목표, S10은 독립 선택이 아니라 위 자리들에 무엇을 넣을지의 문제로 흡수됐다.
//
// 그래서 이 화면은 "선택지 나열"에서 "잠정 결정 위에서 스피너 디자인을 갈아끼워 보는 화면"으로
// 바뀌었다. 상단에서 스피너 시안·문구안·테마를 고르면 아래 모든 자리가 그 조합으로 다시 그려진다.
//
// 선택이 확정되면 이 파일과 App.tsx의 /debug/loading 라우트를 삭제하고, 확정된 규칙을
// docs/foundation/design-system.md "로딩 표현" 섹션으로 옮길 것.
//
// 아직 앱에 없는 것(트레일 링 외 스피너 6종, 인디터미네이트 바)은 이 파일 안에서만 정의한다 —
// 채택 시 keyframe을 index.css로 옮기고(Tailwind v4는 motion-reduce가 먹으려면 @utility 등록 필요)
// 컴포넌트를 src/components/로 승격할 것.

const PREVIEW_STYLES = `
/* 1. 트레일 링 — 현행 MapleSpinner(외곽선 둘레의 70% 구간이 도는 comet) */
@keyframes dbg-trail { to { stroke-dashoffset: -300 } }
.dbg-trail { animation: dbg-trail 0.9s linear infinite }

/* 2. 드로잉 — 외곽선을 그렸다가 지운다 */
@keyframes dbg-draw {
  0% { stroke-dashoffset: 300 }
  45% { stroke-dashoffset: 0 }
  100% { stroke-dashoffset: -300 }
}
.dbg-draw { animation: dbg-draw 1.8s ease-in-out infinite }

/* 3. 펄스 — 채워진 잎이 숨쉬고 뒤로 후광이 퍼진다 */
@keyframes dbg-pulse {
  0%, 100% { transform: scale(0.84); opacity: 0.5 }
  50% { transform: scale(1); opacity: 1 }
}
@keyframes dbg-halo {
  0% { transform: scale(0.85); opacity: 0.4 }
  100% { transform: scale(1.5); opacity: 0 }
}
.dbg-pulse { animation: dbg-pulse 1.3s ease-in-out infinite }
.dbg-halo { animation: dbg-halo 1.3s ease-out infinite }

/* 4. 회전 — 잎 한 장이 자전한다 */
@keyframes dbg-spin { to { transform: rotate(360deg) } }
.dbg-spin { animation: dbg-spin 1.1s linear infinite }

/* 5. 낙엽 — 좌우로 기울며 살짝 위아래로 흔들린다 */
@keyframes dbg-sway {
  0%, 100% { transform: rotate(-20deg) translateY(-3px) }
  50% { transform: rotate(20deg) translateY(3px) }
}
.dbg-sway { animation: dbg-sway 1.5s ease-in-out infinite }

/* 6. 스윕 — 흐린 잎 위로 밝은 띠가 위에서 아래로 훑고 지나간다 */
@keyframes dbg-sweep { to { transform: translateY(230px) } }
.dbg-sweep { animation: dbg-sweep 1.4s ease-in-out infinite }

/* 7. 궤도 — 작은 잎 3장이 원을 돈다(각 잎은 시차를 두고 밝아진다) */
@keyframes dbg-orbit { to { transform: rotate(360deg) } }
@keyframes dbg-orbit-fade {
  0%, 100% { opacity: 0.45 }
  30% { opacity: 1 }
}
.dbg-orbit { animation: dbg-orbit 1.6s linear infinite }
.dbg-orbit-leaf { animation: dbg-orbit-fade 1.6s ease-in-out infinite }

/* SVG 안에서 transform-origin: center 가 도형 bbox 기준으로 잡히게 한다 */
.dbg-spin, .dbg-sway, .dbg-pulse, .dbg-halo, .dbg-orbit, .dbg-orbit-leaf {
  transform-box: fill-box;
  transform-origin: center;
}

/* S7 후보 — 모달 카드 상단에 붙는 인디터미네이트 띠 */
@keyframes dbg-indeterminate {
  0% { transform: translateX(-110%) }
  100% { transform: translateX(410%) }
}
.dbg-indeterminate { animation: dbg-indeterminate 1.2s ease-in-out infinite }
`

// ---------------------------------------------------------------------------
// 스피너 시안 7종
// ---------------------------------------------------------------------------

type SpinnerVariant = 'trail' | 'draw' | 'pulse' | 'spin' | 'sway' | 'sweep' | 'orbit'

const VARIANTS: { id: SpinnerVariant; label: string; note: string }[] = [
  { id: 'trail', label: '트레일 링', note: '현행 — 외곽선 70% 구간이 도는 comet' },
  { id: 'draw', label: '드로잉', note: '외곽선을 그렸다 지운다 — 큰 자리에서 잘 읽힌다' },
  { id: 'pulse', label: '펄스', note: '채워진 잎 + 후광 — 작은 크기에서도 존재감이 있다' },
  { id: 'spin', label: '회전', note: '잎 한 장이 자전 — 가장 보편적인 "로딩" 신호' },
  { id: 'sway', label: '낙엽', note: '좌우로 기울며 흔들린다 — 조용하지만 로딩으로 안 읽힐 수 있다' },
  { id: 'sweep', label: '스윕', note: '흐린 잎 위를 밝은 띠가 훑는다 — 스켈레톤 샤인과 같은 어법' },
  { id: 'orbit', label: '궤도', note: '작은 잎 3장이 원을 돈다 — 점 3개 스피너의 단풍잎판' },
]

interface SpinnerProps {
  variant: SpinnerVariant
  size?: number
  className?: string
}

// 잎 bbox 중심(대략). 궤도형에서 작은 잎을 원주 위에 놓을 때 기준으로 쓴다.
const LEAF_CX = 63.5
const LEAF_CY = 65

// 궤도 반지름과 잎 배율은 서로 묶여 있다 — 작은 크기(16px)에서도 잎 모양이 남으려면 배율을 키워야
// 하고, 배율을 키우면 반지름을 줄여야 viewBox를 넘지 않는다.
function orbitLeafTransform(angleDeg: number): string {
  const radius = 38
  const scale = 0.44
  const radian = (angleDeg * Math.PI) / 180
  const x = LEAF_CX + radius * Math.cos(radian)
  const y = LEAF_CY + radius * Math.sin(radian)
  return `translate(${x} ${y}) scale(${scale}) translate(${-LEAF_CX} ${-LEAF_CY})`
}

export function Spinner(props: SpinnerProps): React.JSX.Element {
  const uid = useId()
  const size = props.size ?? 20
  const clipId = `dbg-leaf-clip-${uid}`
  const gradientId = `dbg-sweep-gradient-${uid}`

  const svgProps = {
    'aria-hidden': true as const,
    width: size,
    height: size * (130 / 127),
    viewBox: '0 0 127 130',
    className: props.className,
  }

  switch (props.variant) {
    case 'trail':
      return (
        <svg {...svgProps}>
          <path
            d={MAPLE_LEAF_PATH}
            pathLength={300}
            fill="none"
            stroke="currentColor"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray="210 90"
            className="dbg-trail"
          />
        </svg>
      )

    case 'draw':
      return (
        <svg {...svgProps}>
          <path
            d={MAPLE_LEAF_PATH}
            pathLength={300}
            fill="none"
            stroke="currentColor"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray="300 300"
            className="dbg-draw"
          />
        </svg>
      )

    case 'pulse':
      return (
        <svg {...svgProps} overflow="visible">
          <path d={MAPLE_LEAF_PATH} fill="currentColor" opacity={0.35} className="dbg-halo" />
          <path d={MAPLE_LEAF_PATH} fill="currentColor" className="dbg-pulse" />
        </svg>
      )

    case 'spin':
      return (
        <svg {...svgProps}>
          <path d={MAPLE_LEAF_PATH} fill="currentColor" className="dbg-spin" />
        </svg>
      )

    case 'sway':
      return (
        <svg {...svgProps}>
          <path d={MAPLE_LEAF_PATH} fill="currentColor" className="dbg-sway" />
        </svg>
      )

    // clipPath의 직접 자식은 도형 요소여야 한다 — <g>로 묶으면 Chrome이 조용히 무시해 빈 클립이
    // 된다(MapleWaveProgress에서 겪은 트랩). 여기서는 <path> 하나만 자식으로 둔다.
    case 'sweep':
      return (
        <svg {...svgProps}>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={MAPLE_LEAF_PATH} />
            </clipPath>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={MAPLE_LEAF_PATH} fill="currentColor" opacity={0.32} />
          <g clipPath={`url(#${clipId})`}>
            <rect
              className="dbg-sweep"
              x="-10"
              y="-90"
              width="147"
              height="80"
              fill={`url(#${gradientId})`}
            />
          </g>
        </svg>
      )

    case 'orbit':
      return (
        <svg {...svgProps}>
          <g className="dbg-orbit">
            {[-90, 30, 150].map((angle, index) => (
              <path
                key={angle}
                d={MAPLE_LEAF_PATH}
                fill="currentColor"
                transform={orbitLeafTransform(angle)}
                className="dbg-orbit-leaf"
                style={{ animationDelay: `${index * 0.53}s` }}
              />
            ))}
          </g>
        </svg>
      )
  }
}

// ---------------------------------------------------------------------------
// 문구안 — S9("'~중...'은 새로고침 옆 '조회 중...'만 남긴다")를 버튼 라벨과 어떻게 맞출지
// ---------------------------------------------------------------------------

type ToneId = 'polite' | 'short'

interface Copy {
  verifyBtn: string
  deleteBtn: string
  disconnectBtn: string
  coldStart: string
  backfill: string
  applying: string
  verifyingAccount: string
  prefetching: string
  saving: string
}

// 규칙(사용자 지침): 제거 대상은 말줄임표가 붙는 '~중...' 형태다. 버튼 내부처럼 폭이 좁은 자리는
// 말줄임표를 뺀 '~중'을 쓸 수 있다. 말줄임표가 살아남는 곳은 새로고침 옆 '조회 중...' 한 곳뿐.
const COPY: Record<ToneId, Copy> = {
  // 안 1 — 버튼까지 전부 '~하고 있어요'. 톤이 한 갈래로 모이는 대신 버튼 라벨이 길어진다.
  polite: {
    verifyBtn: '확인하고 있어요',
    deleteBtn: '삭제하고 있어요',
    disconnectBtn: '해제하고 있어요',
    coldStart: '불러오고 있어요',
    backfill: '7월 3주차 기록을 불러오고 있어요',
    applying: '적용하고 있어요',
    verifyingAccount: '캐릭터 목록을 확인하고 있어요',
    prefetching: '캐릭터 정보를 준비하고 있어요',
    saving: '캐릭터 정보를 저장하고 있어요',
  },
  // 안 2 — 버튼은 말줄임표 없는 '~중', 나머지는 '~하고 있어요'.
  short: {
    verifyBtn: '확인 중',
    deleteBtn: '삭제 중',
    disconnectBtn: '해제 중',
    coldStart: '불러오고 있어요',
    backfill: '7월 3주차 기록을 불러오고 있어요',
    applying: '적용하고 있어요',
    verifyingAccount: '캐릭터 목록을 확인하고 있어요',
    prefetching: '캐릭터 정보를 준비하고 있어요',
    saving: '캐릭터 정보를 저장하고 있어요',
  },
}

// ---------------------------------------------------------------------------
// 공통 훅·목업
// ---------------------------------------------------------------------------

const THEME_OPTIONS: ThemeName[] = ['머쉬맘', '혼테일', '레테', '렌']

function applyThemeToDocument(theme: ThemeName): void {
  if (theme === '머쉬맘') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
}

// 이 화면의 테마 전환은 미리보기 전용이라 저장하지 않는다. 떠날 때 저장된 테마로 되돌린다.
function useLocalThemePreview(): [ThemeName, (theme: ThemeName) => void] {
  const { theme: storedTheme } = useThemeStore()
  const [theme, setTheme] = useState<ThemeName>(storedTheme)

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  useEffect(() => {
    return () => {
      applyThemeToDocument(useThemeStore.getState().theme)
    }
  }, [])

  return [theme, setTheme]
}

function usePreviewPercent(): number {
  const [percent, setPercent] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setPercent((prev) => (prev >= 100 ? 0 : prev + 2))
    }, 100)
    return () => window.clearInterval(id)
  }, [])
  return percent
}

function Chip(props: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
      className={
        props.selected
          ? 'rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary'
          : 'rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-muted'
      }
    >
      {props.children}
    </button>
  )
}

type SectionState = '잠정 결정' | '새로 디자인' | '비교'

const STATE_CLASSES: Record<SectionState, string> = {
  '잠정 결정': 'bg-secondary/20 text-secondary-text',
  '새로 디자인': 'bg-third/20 text-third-text',
  비교: 'bg-primary/15 text-primary',
}

function Section(props: {
  code: string
  title: string
  state: SectionState
  note: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-text">
            <span className="text-primary">{props.code}</span> {props.title}
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATE_CLASSES[props.state]}`}
          >
            {props.state}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-text-muted">{props.note}</p>
      </div>
      <div className="space-y-4">{props.children}</div>
    </section>
  )
}

function Option(props: { label: string; note: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-text">
          {props.label}
        </span>
        <span className="text-xs leading-relaxed text-text-muted">{props.note}</span>
      </div>
      <div className="rounded-[14px] border border-dashed border-border bg-bg p-4">{props.children}</div>
    </div>
  )
}

const PRIMARY_BTN =
  'w-full rounded-full bg-primary text-bg font-semibold px-5 py-2.5 text-sm flex items-center justify-center gap-2'
const DANGER_BTN =
  'w-full rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error flex items-center justify-center gap-2'

function MockRow(props: { name: string; tag: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border px-4 py-3">
      <span className="h-[18px] w-[18px] shrink-0 rounded bg-primary/25" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{props.name}</span>
      <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-muted">
        {props.tag}
      </span>
    </div>
  )
}

function MockSchedulerHeader(props: { syncSlot: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-text">컨텐츠</h3>
      <div className="rounded-[10px] border border-border bg-surface px-4 py-2.5 text-sm text-text">
        메이플용사 · Lv.291
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary">일간</span>
          <span className="px-3 text-sm font-medium text-text-muted">주간</span>
        </div>
        <div className="flex items-center gap-1">{props.syncSlot}</div>
      </div>
    </div>
  )
}

function MockModalCard(props: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div
      className={`relative mx-auto w-full max-w-sm overflow-hidden rounded-[14px] border border-border bg-surface p-6 ${props.className ?? ''}`}
    >
      {props.children}
    </div>
  )
}

function MockModeOptions(props: { dimmed?: boolean }): React.JSX.Element {
  return (
    <div className={`space-y-2 ${props.dimmed === true ? 'opacity-40' : ''}`}>
      <div className="rounded-[10px] border border-primary bg-primary/15 px-4 py-3 text-sm font-semibold text-text">
        자동
      </div>
      <div className="rounded-[10px] border border-border px-4 py-3 text-sm font-semibold text-text">수동</div>
    </div>
  )
}

// 캐시 삭제 모달의 그룹 체크 목록 — S7-C는 이 모달이 실제 대상이라(액션 버튼이 있는 유일한 차단
// 모달) 자동/수동 선택지 대신 실제 내용으로 목업한다.
function MockCacheGroups(props: { dimmed?: boolean }): React.JSX.Element {
  return (
    <div className={`border-t border-border ${props.dimmed === true ? 'opacity-40' : ''}`}>
      {[
        { label: '일반 데이터', size: '3.1 MB' },
        { label: '보스 수익·드롭 기록', size: '9.3 MB' },
      ].map((group) => (
        <div key={group.label} className="flex items-start gap-3 border-b border-border py-3">
          <span className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[5px] bg-primary" />
          <span className="flex flex-1 items-center justify-between gap-3">
            <span className="text-sm font-semibold text-text">{group.label}</span>
            <span className="shrink-0 text-sm text-text-muted tabular-nums">{group.size}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ProgressBar(props: { percent: number }): React.JSX.Element {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${props.percent}%` }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

export function LoadingPreview(): React.JSX.Element {
  const [theme, setTheme] = useLocalThemePreview()
  const [variant, setVariant] = useState<SpinnerVariant>('trail')
  const [tone, setTone] = useState<ToneId>('short')
  const percent = usePreviewPercent()
  const completed = Math.round((percent / 100) * 12)
  const copy = COPY[tone]

  return (
    <div className="min-h-screen bg-bg px-4 pb-16 pt-[calc(1rem+var(--sa-top))]">
      <style>{PREVIEW_STYLES}</style>

      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2">
          <h1 className="text-lg font-bold text-text">로딩 시안 비교 (ADR-061)</h1>
          <p className="text-xs leading-relaxed text-text-muted">
            1차 선택을 전제로 스피너 디자인을 갈아끼워 보는 화면. 위에서 시안·문구안·테마를 고르면 아래
            모든 자리가 그 조합으로 다시 그려진다. 진행률은 5초 주기로 0→100%를 반복 재생한다.
          </p>
        </header>

        <div className="space-y-3 rounded-[14px] border border-border bg-surface p-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-text">스피너 시안</p>
            <div className="flex flex-wrap gap-2">
              {VARIANTS.map((item) => (
                <Chip key={item.id} selected={variant === item.id} onClick={() => setVariant(item.id)}>
                  <span className="flex items-center gap-1.5">
                    <Spinner variant={item.id} size={13} />
                    {item.label}
                  </span>
                </Chip>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-text-muted">
              {VARIANTS.find((item) => item.id === variant)?.note}
            </p>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-xs font-bold text-text">문구안 (S9)</p>
            <div className="flex flex-wrap gap-2">
              <Chip selected={tone === 'short'} onClick={() => setTone('short')}>
                버튼은 ~중
              </Chip>
              <Chip selected={tone === 'polite'} onClick={() => setTone('polite')}>
                전부 ~하고 있어요
              </Chip>
            </div>
            <p className="text-[11px] leading-relaxed text-text-muted">
              제거 대상은 말줄임표가 붙는 &apos;~중...&apos; 형태다. 버튼 내부는 말줄임표를 뺀
              &apos;~중&apos;을 쓸 수 있고, 말줄임표가 살아남는 곳은 새로고침 옆 &apos;조회 중...&apos;
              한 곳뿐이다.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-xs font-bold text-text">테마</p>
            <div className="flex flex-wrap gap-2">
              {THEME_OPTIONS.map((option) => (
                <Chip key={option} selected={theme === option} onClick={() => setTheme(option)}>
                  {option}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="시안"
          title="스피너 7종 — 크기별"
          state="비교"
          note="위 16px(버튼 안) · 가운데 24px(영역) · 아래 32px(화면·모달). 실제로 쓰이는 세 크기다."
        >
          <div className="rounded-[14px] border border-dashed border-border bg-bg p-4">
            <div className="space-y-4 text-primary">
              {[16, 24, 32].map((size) => (
                <div key={size} className="flex items-center justify-between gap-1">
                  {VARIANTS.map((item) => (
                    <div key={item.id} className="flex flex-1 justify-center">
                      <Spinner variant={item.id} size={size} />
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex items-center justify-between gap-1">
                {VARIANTS.map((item) => (
                  <div key={item.id} className="flex-1 text-center text-[9px] leading-tight text-text-muted">
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S1"
          title="버튼 내부 대기 — 스피너 + 라벨 병기"
          state="잠정 결정"
          note="온보딩·설정 구분 없이 모든 제출 버튼이 같은 형태. 라벨이 남으므로 S9 문구안이 여기서 갈린다."
        >
          <Option label="적용" note="온보딩 API 키 확인 / 캐시 데이터 삭제 / 연결 해제">
            <div className="space-y-2">
              <button type="button" className={PRIMARY_BTN}>
                <Spinner variant={variant} size={16} />
                {copy.verifyBtn}
              </button>
              <button type="button" className={DANGER_BTN}>
                <Spinner variant={variant} size={16} />
                {copy.deleteBtn}
              </button>
              <button type="button" className={DANGER_BTN}>
                <Spinner variant={variant} size={16} />
                {copy.disconnectBtn}
              </button>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S2"
          title="콜드 스타트 — 스피너 32 + 문구"
          state="잠정 결정"
          note="스케줄러 3화면 · 관리 화면 2곳 · 앱 부팅 복원 · 온보딩 시드가 모두 이 형태를 공유한다."
        >
          <Option label="적용" note="보여줄 데이터가 하나도 없을 때만. 캐시가 있으면 S3로 간다.">
            <MockSchedulerHeader
              syncSlot={
                <span className="p-2 text-primary-text">
                  <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
              }
            />
            <div className="flex min-h-[168px] flex-col items-center justify-center gap-3">
              <Spinner variant={variant} size={32} className="text-primary" />
              <p className="text-sm text-text-muted">{copy.coldStart}</p>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S3"
          title="SWR 재검증 — 현행 유지"
          state="잠정 결정"
          note="스피너를 쓰지 않는 유일한 로딩 자리. '조회 중...'은 앱에서 유일하게 남는 '~중...' 문구다."
        >
          <Option label="적용" note="캐시가 화면에 남아 있으므로 가리지 않는다(ADR-016)">
            <MockSchedulerHeader
              syncSlot={
                <>
                  <p className="whitespace-nowrap text-sm text-text-muted">조회 중...</p>
                  <span className="p-2 text-primary-text">
                    <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                  </span>
                </>
              }
            />
            <div className="mt-3 space-y-2">
              <MockRow name="일일 퀘스트" tag="3/5" />
              <MockRow name="몬스터파크" tag="2/3" />
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S4"
          title="영역 부분 로딩 — 점선 없는 새 디자인"
          state="새로 디자인"
          note="보스 수익 과거 기간 백필. 기간 화살표를 누를 때마다 반복해 뜨고, 끝나면 캐릭터 카드가 그 자리를 채운다. 점선 박스는 빈 상태(EmptyState)의 어법이라 로딩과 겹쳤던 것이 문제였다."
        >
          <Option
            label="A"
            note="셸 승계 — 로딩 후 나타날 캐릭터 카드와 같은 실선 surface 카드. 카드가 자리를 먼저 잡아 결과가 들어와도 화면이 튀지 않는다."
          >
            <div className="rounded-[14px] border border-border bg-surface p-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <Spinner variant={variant} size={24} className="text-primary" />
                <p className="text-xs text-text-muted">{copy.backfill}</p>
              </div>
            </div>
          </Option>

          <Option
            label="B"
            note="알약 — 스피너와 문구를 한 줄 배지로 묶어 중앙에. 높이가 낮아 기간을 연달아 넘겨도 화면 요동이 가장 적다."
          >
            <div className="flex justify-center py-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-2 pl-2.5 pr-4">
                <Spinner variant={variant} size={16} className="text-primary" />
                <span className="text-xs font-medium text-text-muted">{copy.backfill}</span>
              </span>
            </div>
          </Option>

          <Option
            label="C"
            note="맨몸 — 테두리도 배경도 없이 스피너 + 문구만. 가장 조용하지만 '무엇을 기다리는지'를 문구 혼자 감당한다."
          >
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Spinner variant={variant} size={24} className="text-primary" />
              <p className="text-xs text-text-muted">{copy.backfill}</p>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S7"
          title="모달 차단 작업 — 새 디자인"
          state="새로 디자인"
          note="모드 전환(시드) · 계정 검증 · 캐시 삭제. 공통 요구는 '진행 중임이 보이고, 닫을 수 없음이 전달되고, 무슨 선택을 하던 중이었는지 맥락이 사라지지 않는 것'."
        >
          <Option
            label="A"
            note="상단 띠 + 본문 딤 — 카드 최상단에 인디터미네이트 띠, 선택지는 흐려져 맥락만 남는다. 카드 크기가 변하지 않아 모달이 튀지 않는다."
          >
            <MockModalCard>
              <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-surface-2">
                <div className="dbg-indeterminate h-full w-1/4 rounded-full bg-primary" />
              </div>
              <div className="mb-4 space-y-1">
                <h4 className="text-lg font-semibold text-text">스케줄 관리 방법</h4>
                <p className="text-sm text-text-muted">진행 상황을 어떻게 관리할지 선택해주세요.</p>
              </div>
              <MockModeOptions dimmed />
              <p className="mt-4 text-center text-sm font-medium text-text">{copy.applying}</p>
            </MockModalCard>
          </Option>

          <Option
            label="B"
            note="스크림 오버레이 — 카드 위에 반투명 층을 덮고 그 위에 스피너 + 문구. 선택지가 비쳐 맥락이 남고, 덮개 자체가 '지금은 못 누른다'를 말한다."
          >
            <MockModalCard>
              <div className="mb-4 space-y-1">
                <h4 className="text-lg font-semibold text-text">스케줄 관리 방법</h4>
                <p className="text-sm text-text-muted">진행 상황을 어떻게 관리할지 선택해주세요.</p>
              </div>
              <MockModeOptions />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/85 backdrop-blur-[2px]">
                <Spinner variant={variant} size={32} className="text-primary" />
                <p className="text-sm font-medium text-text">{copy.applying}</p>
              </div>
            </MockModalCard>
          </Option>

          <Option
            label="C"
            note="상태 줄 승계 — 액션 버튼이 있던 자리를 스피너 + 문구 한 줄이 그대로 이어받는다. 누를 것이 사라지는 것으로 차단을 말한다."
          >
            <MockModalCard>
              <div className="mb-4 space-y-1">
                <h4 className="text-base font-bold text-text">캐시 데이터 삭제</h4>
                <p className="text-sm text-text-muted">지울 데이터를 선택하세요.</p>
              </div>
              <MockCacheGroups dimmed />
              <div className="mt-4 flex items-center justify-center gap-2 rounded-full bg-surface-2 py-2.5">
                <Spinner variant={variant} size={16} className="text-primary" />
                <span className="text-sm font-medium text-text-muted">{copy.deleteBtn}</span>
              </div>
            </MockModalCard>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S5 · S6"
          title="결정형 진행률 — 전부 얇은 바(h-1.5)"
          state="잠정 결정"
          note="예열·저장·다운로드가 같은 프리미티브를 쓴다. MapleWaveProgress와 h-2 변형은 폐기 대상 — 물결형이 앱에서 사라진다는 뜻이다."
        >
          <Option label="적용" note="온보딩 예열(화면) / 캐릭터 관리 저장(모달) / OTA 다운로드(모달)">
            <div className="space-y-2 py-2">
              <p className="text-sm text-text-muted">
                {copy.prefetching} ({completed}/12)
              </p>
              <ProgressBar percent={percent} />
            </div>
            <MockModalCard className="mt-3">
              <div className="space-y-2">
                <p className="text-sm text-text-muted">
                  {copy.saving} ({completed}/12)
                </p>
                <ProgressBar percent={percent} />
              </div>
            </MockModalCard>
            <MockModalCard className="mt-3">
              <div className="space-y-3 text-center">
                <h4 className="text-base font-semibold text-text">다운로드 중</h4>
                <ProgressBar percent={percent} />
                <p className="text-xs font-medium tabular-nums text-text-muted">{percent}%</p>
              </div>
            </MockModalCard>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S8"
          title="값 하나가 늦게 채워지는 자리 — '- KB'"
          state="잠정 결정"
          note="조회 전에도 같은 폭·같은 타이포로 자리를 잡아 값이 들어와도 레이아웃이 밀리지 않는다."
        >
          <Option label="적용" note="위: 조회 전 / 아래: 조회 후">
            <div className="space-y-2">
              <div className="rounded-[14px] border border-border bg-surface px-6">
                <div className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium text-text">캐시 데이터 삭제</span>
                  <span className="text-sm text-text-muted tabular-nums">- KB</span>
                </div>
              </div>
              <div className="rounded-[14px] border border-border bg-surface px-6">
                <div className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium text-text">캐시 데이터 삭제</span>
                  <span className="text-sm text-text-muted tabular-nums">12.4 MB</span>
                </div>
              </div>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S9"
          title="문구 — 말줄임표가 남는 곳은 한 곳뿐"
          state="비교"
          note="제거 대상은 말줄임표가 붙는 '~중...'이다. 버튼 내부는 말줄임표를 뺀 '~중'을 쓸 수 있으므로, 두 안의 차이는 버튼 라벨에서만 난다 — 나머지 자리는 어느 안이든 '~하고 있어요'다."
        >
          <Option label="A" note="버튼은 ~중(말줄임표 없음) — 버튼 폭 변화가 적다">
            <div className="space-y-2">
              <button type="button" className={PRIMARY_BTN}>
                <Spinner variant={variant} size={16} />
                {COPY.short.verifyBtn}
              </button>
              <button type="button" className={DANGER_BTN}>
                <Spinner variant={variant} size={16} />
                {COPY.short.deleteBtn}
              </button>
            </div>
          </Option>

          <Option label="B" note="버튼까지 ~하고 있어요 — 톤이 한 갈래로 모이지만 라벨이 길어진다">
            <div className="space-y-2">
              <button type="button" className={PRIMARY_BTN}>
                <Spinner variant={variant} size={16} />
                {COPY.polite.verifyBtn}
              </button>
              <button type="button" className={DANGER_BTN}>
                <Spinner variant={variant} size={16} />
                {COPY.polite.deleteBtn}
              </button>
            </div>
          </Option>

          <Option label="예외" note="말줄임표가 유일하게 남는 곳 — 새로고침 버튼 옆">
            <div className="flex items-center justify-end gap-1">
              <p className="whitespace-nowrap text-sm text-text-muted">조회 중...</p>
              <span className="p-2 text-primary-text">
                <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              </span>
            </div>
          </Option>
        </Section>
      </div>
    </div>
  )
}
