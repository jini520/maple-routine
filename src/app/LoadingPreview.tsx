import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { MapleSpinner } from '../components/MapleSpinner/MapleSpinner'
import { MapleWaveProgress } from '../components/MapleWaveProgress/MapleWaveProgress'
import { MAPLE_LEAF_PATH } from '../components/mapleLeafPath'
import { useThemeStore } from '../features/theme/store'
import type { ThemeName } from '../types/theme'

// 임시 디버그 화면 — [[ADR-061]](로딩 표현 통일)의 상황별 선택지를 실제 모션으로 비교한다.
// 텍스트 표만으로는 "스피너냐 스켈레톤이냐"를 판단할 수 없어, 각 선택지를 실제로 놓일 자리와
// 비슷한 프레임(헤더·목록·모달·설정 행) 안에 렌더한다.
// 선택이 확정되면 이 파일과 App.tsx의 /debug/loading 라우트를 삭제하고, 확정된 규칙을
// docs/foundation/design-system.md "로딩 표현" 섹션으로 옮길 것.
//
// 후보 프리미티브 중 아직 앱에 없는 것(드로잉형·펄스형 스피너, 스켈레톤, 인디터미네이트 바)은
// 이 파일 안에서만 정의한다 — 채택되기 전에 index.css를 오염시키지 않으려는 것이라, 채택 시
// keyframe을 index.css로 옮기고(Tailwind v4는 motion-reduce가 먹으려면 @utility 등록 필요)
// 컴포넌트는 src/components/로 승격할 것.

const PREVIEW_STYLES = `
@keyframes dbg-maple-draw {
  0% { stroke-dashoffset: 300 }
  45% { stroke-dashoffset: 0 }
  100% { stroke-dashoffset: -300 }
}
.dbg-maple-draw { animation: dbg-maple-draw 1.8s ease-in-out infinite }

@keyframes dbg-maple-pulse {
  0%, 100% { transform: scale(0.84); opacity: 0.5 }
  50% { transform: scale(1); opacity: 1 }
}
.dbg-maple-pulse {
  animation: dbg-maple-pulse 1.3s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes dbg-maple-halo {
  0% { transform: scale(0.85); opacity: 0.45 }
  100% { transform: scale(1.5); opacity: 0 }
}
.dbg-maple-halo {
  animation: dbg-maple-halo 1.3s ease-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes dbg-indeterminate {
  0% { transform: translateX(-110%) }
  100% { transform: translateX(410%) }
}
.dbg-indeterminate { animation: dbg-indeterminate 1.2s ease-in-out infinite }
`

const THEME_OPTIONS: ThemeName[] = ['머쉬맘', '혼테일', '레테', '렌']

function applyThemeToDocument(theme: ThemeName): void {
  if (theme === '머쉬맘') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
}

// 이 화면의 테마 전환은 미리보기 전용이라 저장하지 않는다(스토어를 거치지 않고 document에만 적용).
// 화면을 떠날 때 저장된 테마로 되돌린다.
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

// 결정형 진행률 선택지는 멈춰 있으면 비교가 안 되므로 0→100%를 5초 주기로 반복 재생한다.
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

// ---------------------------------------------------------------------------
// 후보 프리미티브 (앱에 아직 없는 것들)
// ---------------------------------------------------------------------------

interface CandidateSpinnerProps {
  size?: number
  className?: string
}

// P9-a 드로잉형 — 외곽선을 그렸다가 지운다.
function MapleDrawSpinner(props: CandidateSpinnerProps): React.JSX.Element {
  const size = props.size ?? 32
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
      className={props.className}
    >
      <path
        d={MAPLE_LEAF_PATH}
        pathLength={300}
        fill="none"
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray="300 300"
        className="dbg-maple-draw"
      />
    </svg>
  )
}

// P9-b 펄스형 — 채워진 잎이 숨쉬듯 커졌다 작아지고 뒤로 후광이 퍼진다.
function MaplePulseSpinner(props: CandidateSpinnerProps): React.JSX.Element {
  const size = props.size ?? 32
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
      overflow="visible"
      className={props.className}
    >
      <path d={MAPLE_LEAF_PATH} fill="currentColor" opacity={0.35} className="dbg-maple-halo" />
      <path d={MAPLE_LEAF_PATH} fill="currentColor" className="dbg-maple-pulse" />
    </svg>
  )
}

// P5 현행 인라인 CSS 링(보스 수익 백필 1곳) — 비교용으로 그대로 옮겨 그린다.
function RingSpinner(props: { size?: number }): React.JSX.Element {
  const size = props.size ?? 24
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-[3px] border-border border-t-primary animate-spin motion-reduce:animate-none"
    />
  )
}

// P8 스켈레톤 — 채택 시 신설할 프리미티브.
function SkeletonBox(props: { className: string }): React.JSX.Element {
  return <div className={`animate-pulse rounded bg-surface-2 ${props.className}`} />
}

function SkeletonListRow(): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border px-4 py-3">
      <SkeletonBox className="h-[18px] w-[18px] shrink-0" />
      <SkeletonBox className="h-3.5 w-2/5" />
      <SkeletonBox className="ml-auto h-5 w-12 shrink-0 rounded-full" />
    </div>
  )
}

// S3-C 후보 — 페이지 헤더 하단에 붙는 2px 인디터미네이트 바.
function IndeterminateBar(): React.JSX.Element {
  return (
    <div className="h-[2px] w-full overflow-hidden bg-transparent">
      <div className="dbg-indeterminate h-[2px] w-1/4 rounded-full bg-primary" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 미리보기 프레임·목업
// ---------------------------------------------------------------------------

function Section(props: {
  code: string
  title: string
  current: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-text">
          <span className="text-primary">{props.code}</span> {props.title}
        </h2>
        <p className="text-xs leading-relaxed text-text-muted">현재: {props.current}</p>
      </div>
      <div className="space-y-4">{props.children}</div>
    </section>
  )
}

function Option(props: { label: string; note: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
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

// 스케줄러 3화면의 헤더(캐릭터 드롭다운 + 동기화 줄 + 탭)를 축약한 목업.
function MockSchedulerHeader(props: { syncSlot: React.ReactNode; bar?: React.ReactNode }): React.JSX.Element {
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
      {props.bar}
    </div>
  )
}

function RefreshButton(props: { spinning: boolean }): React.JSX.Element {
  return (
    <span className="p-2 text-primary-text">
      <RefreshCw
        className={`h-4 w-4 ${props.spinning ? 'animate-spin' : ''}`}
        strokeWidth={2}
        aria-hidden="true"
      />
    </span>
  )
}

function MockModalCard(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-sm rounded-[14px] border border-border bg-surface p-6">{props.children}</div>
  )
}

function MockSettingsRow(props: { label: string; right: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-6">
      <div className="flex items-center justify-between py-4">
        <span className="text-sm font-medium text-text">{props.label}</span>
        {props.right}
      </div>
    </div>
  )
}

function ProgressBar(props: { percent: number; thick?: boolean }): React.JSX.Element {
  const height = props.thick === true ? 'h-2' : 'h-1.5'
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-surface-2`}>
      <div className={`${height} rounded-full bg-primary`} style={{ width: `${props.percent}%` }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

export function LoadingPreview(): React.JSX.Element {
  const [theme, setTheme] = useLocalThemePreview()
  const percent = usePreviewPercent()
  const completed = Math.round((percent / 100) * 12)

  return (
    <div className="min-h-screen bg-bg px-4 pb-16 pt-[calc(1rem+var(--sa-top))]">
      <style>{PREVIEW_STYLES}</style>

      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2">
          <h1 className="text-lg font-bold text-text">로딩 표현 비교 (ADR-061)</h1>
          <p className="text-xs leading-relaxed text-text-muted">
            상황(S1~S10)마다 선택지를 실제 모션으로 비교하는 임시 화면. 진행률은 5초 주기로 0→100%를 반복
            재생한다. 테마 전환은 이 화면에서만 적용되고 저장되지 않는다.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
              className={
                theme === option
                  ? 'rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary'
                  : 'rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-muted'
              }
            >
              {option}
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S1"
          title="버튼 내부 대기"
          current="온보딩(확인·계속하기)은 스피너, 설정(업데이트 확인·캐시 삭제·연결 해제)은 텍스트만"
        >
          <Option label="A" note="전부 스피너 — 라벨을 스피너가 대체(aria-label로 상태 전달)">
            <div className="space-y-2">
              <button type="button" className={PRIMARY_BTN}>
                <MapleSpinner size={18} />
              </button>
              <button type="button" className={DANGER_BTN}>
                <MapleSpinner size={18} />
              </button>
            </div>
          </Option>

          <Option label="B" note="스피너 + 라벨 병기 — 무엇이 진행 중인지 글자로 남는다(버튼 폭이 흔들림)">
            <div className="space-y-2">
              <button type="button" className={PRIMARY_BTN}>
                <MapleSpinner size={16} />
                확인 중...
              </button>
              <button type="button" className={DANGER_BTN}>
                <MapleSpinner size={16} />
                삭제 중...
              </button>
            </div>
          </Option>

          <Option label="C" note="성격으로 분리 — 조회성은 스피너만, 파괴적 동작은 라벨 병기">
            <div className="space-y-2">
              <button type="button" className={PRIMARY_BTN}>
                <MapleSpinner size={18} />
              </button>
              <button type="button" className={DANGER_BTN}>
                <MapleSpinner size={16} />
                삭제 중...
              </button>
            </div>
          </Option>

          <Option label="D" note="현행 유지 — 온보딩만 스피너, 설정은 라벨 텍스트만">
            <div className="space-y-2">
              <button type="button" className={PRIMARY_BTN}>
                <MapleSpinner size={18} />
              </button>
              <button type="button" className={DANGER_BTN}>
                삭제 중...
              </button>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S2"
          title="콜드 스타트 — 보여줄 데이터가 아예 없음"
          current="스케줄러 3화면은 '불러오는 중...' 한 줄, 관리 화면 2곳·앱 부팅 복원은 표시 없음"
        >
          <Option label="A" note="MapleSpinner 32 + 문구 — 온보딩 시드 화면과 같은 조합">
            <MockSchedulerHeader syncSlot={<RefreshButton spinning={false} />} />
            <div className="flex min-h-[168px] flex-col items-center justify-center gap-3">
              <MapleSpinner size={32} className="text-primary" />
              <p className="text-sm text-text-muted">불러오는 중...</p>
            </div>
          </Option>

          <Option label="B" note="스켈레톤 — 레이아웃 점프가 없고 무엇을 기다리는지 골격이 전달한다(신설 필요)">
            <MockSchedulerHeader syncSlot={<RefreshButton spinning={false} />} />
            <div className="mt-3 space-y-2">
              <SkeletonListRow />
              <SkeletonListRow />
              <SkeletonListRow />
            </div>
          </Option>

          <Option label="C" note="현행 — 텍스트 한 줄만(문구만 '불러오는 중...'으로 통일)">
            <MockSchedulerHeader syncSlot={<RefreshButton spinning={false} />} />
            <div className="mt-3 min-h-[168px]">
              <p className="text-sm text-text-muted">불러오는 중...</p>
            </div>
          </Option>

          <Option label="D" note="혼합 — 목록형은 스켈레톤(위), 결과가 하나뿐인 앱 부팅 복원은 스피너(아래)">
            <div className="space-y-2">
              <SkeletonListRow />
              <SkeletonListRow />
            </div>
            <div className="mt-4 flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-[10px] bg-surface">
              <MapleSpinner size={32} className="text-primary" />
              <p className="text-sm text-text-muted">준비하고 있어요</p>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S3"
          title="SWR 재검증 — 캐시 데이터가 이미 화면에 있음"
          current="'마지막 동기화 3분 전' 자리를 '조회 중...'이 대체 + RefreshCw 회전"
        >
          <Option label="A" note="현행 — 텍스트 + 아이콘 회전(신호 둘)">
            <MockSchedulerHeader
              syncSlot={
                <>
                  <p className="whitespace-nowrap text-sm text-text-muted">조회 중...</p>
                  <RefreshButton spinning={true} />
                </>
              }
            />
            <div className="mt-3 space-y-2">
              <MockRow name="일일 퀘스트" tag="3/5" />
              <MockRow name="몬스터파크" tag="2/3" />
            </div>
          </Option>

          <Option label="B" note="아이콘 회전만 — 마지막 동기화 시각이 유지돼 헤더 폭이 흔들리지 않는다">
            <MockSchedulerHeader
              syncSlot={
                <>
                  <p className="whitespace-nowrap text-sm text-text-muted">3분 전</p>
                  <RefreshButton spinning={true} />
                </>
              }
            />
            <div className="mt-3 space-y-2">
              <MockRow name="일일 퀘스트" tag="3/5" />
              <MockRow name="몬스터파크" tag="2/3" />
            </div>
          </Option>

          <Option label="C" note="헤더 하단 2px 인디터미네이트 바 + 시각 유지(신설 필요)">
            <MockSchedulerHeader
              syncSlot={
                <>
                  <p className="whitespace-nowrap text-sm text-text-muted">3분 전</p>
                  <RefreshButton spinning={false} />
                </>
              }
              bar={<IndeterminateBar />}
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
          title="영역 부분 로딩 — 보스 수익 과거 기간 백필"
          current="점선 카드 안 인라인 CSS 링(앱에서 유일한 비-브랜드 스피너) + 문구"
        >
          <Option label="A" note="MapleSpinner 24로 교체 — 앱 전체에서 '대기 = 단풍잎'으로 단일화">
            <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border p-6 text-center">
              <MapleSpinner size={24} className="text-primary" />
              <p className="text-xs text-text-muted">7월 3주차 기록을 불러오는 중...</p>
            </div>
          </Option>

          <Option label="B" note="스켈레톤 카드 — 백필 후 나타날 캐릭터 카드 골격을 미리 그린다">
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-4">
                <SkeletonBox className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <SkeletonBox className="h-3.5 w-1/3" />
                  <SkeletonBox className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-4">
                <SkeletonBox className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <SkeletonBox className="h-3.5 w-2/5" />
                  <SkeletonBox className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          </Option>

          <Option label="C" note="현행 유지 — 기간을 넘길 때마다 반복해 뜨는 자리라 중립 링이 덜 튄다">
            <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border p-6 text-center">
              <RingSpinner size={24} />
              <p className="text-xs text-text-muted">7월 3주차 기록을 불러오는 중...</p>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S5"
          title="결정형 진행률 — 대량 순차 작업 (N/M)"
          current="같은 작업이 3표현 — 온보딩 예열은 물결, 계정 변경 예열은 얇은 바, 캐릭터 관리 저장은 모달 안 얇은 바"
        >
          <Option label="A" note="전부 MapleWaveProgress — 모달 안에도 64px 브랜드 마크가 들어간다">
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-text-muted">
                캐릭터 정보를 준비하고 있어요 ({completed}/12)
              </p>
              <MapleWaveProgress percent={percent} />
            </div>
            <MockModalCard>
              <div className="space-y-2">
                <p className="text-sm text-text-muted">캐릭터 정보를 저장하고 있어요 ({completed}/12)</p>
                <div className="flex justify-center pt-1">
                  <MapleWaveProgress percent={percent} size={48} />
                </div>
              </div>
            </MockModalCard>
          </Option>

          <Option label="B" note="전부 얇은 바 — design-system '진행률 바 프리미티브 재사용'에 가장 충실">
            <div className="space-y-2 py-4">
              <p className="text-sm text-text-muted">캐릭터 정보를 준비하고 있어요 ({completed}/12)</p>
              <ProgressBar percent={percent} />
            </div>
            <MockModalCard>
              <div className="space-y-2">
                <p className="text-sm text-text-muted">캐릭터 정보를 저장하고 있어요 ({completed}/12)</p>
                <ProgressBar percent={percent} />
              </div>
            </MockModalCard>
          </Option>

          <Option label="C" note="자리로 분리 — 화면 전체는 물결, 모달·카드 안은 얇은 바(현행에서 손댈 곳이 거의 없음)">
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-text-muted">
                캐릭터 정보를 준비하고 있어요 ({completed}/12)
              </p>
              <MapleWaveProgress percent={percent} />
            </div>
            <MockModalCard>
              <div className="space-y-2">
                <p className="text-sm text-text-muted">캐릭터 정보를 저장하고 있어요 ({completed}/12)</p>
                <ProgressBar percent={percent} />
              </div>
            </MockModalCard>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S6"
          title="결정형 진행률 — 다운로드(OTA)"
          current="업데이트 모달은 굵은 바(h-2) + %, 설정 섹션은 '다운로드 중 45%' 텍스트만"
        >
          <Option label="A" note="h-1.5 프리미티브로 통일 — h-2 변형을 없앤다">
            <MockModalCard>
              <div className="space-y-3 text-center">
                <h4 className="text-base font-semibold text-text">다운로드 중</h4>
                <ProgressBar percent={percent} />
                <p className="text-xs font-medium tabular-nums text-text-muted">{percent}%</p>
              </div>
            </MockModalCard>
          </Option>

          <Option label="B" note="현행 h-2 유지 — 모달 주역이면 굵게, 보조면 얇게를 규칙으로 문서화">
            <MockModalCard>
              <div className="space-y-3 text-center">
                <h4 className="text-base font-semibold text-text">다운로드 중</h4>
                <ProgressBar percent={percent} thick />
                <p className="text-xs font-medium tabular-nums text-text-muted">{percent}%</p>
              </div>
            </MockModalCard>
          </Option>

          <Option label="C" note="MapleWaveProgress — 업데이트 모달은 앱이 말을 거는 자리라 브랜드 마크">
            <MockModalCard>
              <div className="flex flex-col items-center gap-3 text-center">
                <h4 className="text-base font-semibold text-text">다운로드 중</h4>
                <MapleWaveProgress percent={percent} />
              </div>
            </MockModalCard>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S7"
          title="모달 차단 작업 — 진행 중엔 닫을 수 없음"
          current="갈림 — 모드 전환은 스피너+문구, 계정 검증은 문구만, 캐시 삭제는 버튼 라벨만"
        >
          <Option label="A" note="스피너 + 문구로 통일 — 선택지는 그대로 두고 아래에 상태 줄을 붙인다">
            <MockModalCard>
              <div className="mb-4 space-y-1">
                <h4 className="text-lg font-semibold text-text">스케줄 관리 방법</h4>
                <p className="text-sm text-text-muted">진행 상황을 어떻게 관리할지 선택해주세요.</p>
              </div>
              <div className="space-y-2 opacity-50">
                <div className="rounded-[10px] border border-primary bg-primary/15 px-4 py-3 text-sm font-semibold text-text">
                  자동
                </div>
                <div className="rounded-[10px] border border-border px-4 py-3 text-sm font-semibold text-text">
                  수동
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
                <MapleSpinner size={18} />
                <span>적용하고 있어요</span>
              </div>
            </MockModalCard>
          </Option>

          <Option label="B" note="본문 전체를 로딩으로 교체 — '지금은 못 누른다'가 가장 명확하지만 취소 경로도 사라진다">
            <MockModalCard>
              <div className="flex flex-col items-center gap-3 py-6">
                <MapleSpinner size={32} className="text-primary" />
                <p className="text-sm text-text-muted">적용하고 있어요</p>
              </div>
            </MockModalCard>
          </Option>

          <Option label="C" note="현행 — 문구만(계정 검증) / 버튼 라벨만(캐시 삭제, 최대 10초)">
            <div className="space-y-3">
              <MockModalCard>
                <p className="text-sm text-text-muted">캐릭터 목록을 확인하고 있어요...</p>
              </MockModalCard>
              <MockModalCard>
                <div className="flex justify-end gap-2">
                  <span className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted opacity-50">
                    취소
                  </span>
                  <span className="rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error opacity-50">
                    삭제 중...
                  </span>
                </div>
              </MockModalCard>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S8"
          title="값 하나가 늦게 채워지는 자리 — 캐시 용량"
          current="빈 문자열 / 용량 span 자체를 렌더하지 않아 레이아웃이 점프한다"
        >
          <Option label="현행" note="값이 툭 나타난다(비교 기준)">
            <MockSettingsRow label="캐시 데이터 삭제" right={<span className="text-sm text-text-muted" />} />
          </Option>

          <Option label="A" note="스켈레톤 칩 — 자리를 미리 잡아 점프가 없다">
            <MockSettingsRow label="캐시 데이터 삭제" right={<SkeletonBox className="h-4 w-14" />} />
          </Option>

          <Option label="B" note="자리만 예약하고 — 표시 — 애니메이션 없이 가장 조용하다">
            <MockSettingsRow label="캐시 데이터 삭제" right={<span className="text-sm text-text-muted">—</span>} />
          </Option>

          <Option label="C" note="MapleSpinner 14 — 설정 행마다 단풍잎이 돌면 과할 수 있다">
            <MockSettingsRow
              label="캐시 데이터 삭제"
              right={<MapleSpinner size={14} className="text-text-muted" />}
            />
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S9"
          title="문구 규칙"
          current="9종 혼재 — '~중...'(6) vs '~하고 있어요'(4), 말줄임표도 ... 와 … 가 섞임"
        >
          <Option label="A" note="전부 '~하고 있어요' — 앱 전반의 존댓말 톤과 일치, 버튼 안에서는 길다">
            <ul className="space-y-1.5 text-sm text-text-muted">
              <li>목록을 불러오고 있어요</li>
              <li>최신 정보를 확인하고 있어요</li>
              <li>캐시를 삭제하고 있어요</li>
              <li>연결을 해제하고 있어요</li>
            </ul>
          </Option>

          <Option label="B" note="전부 '~중...' — 짧아 좁은 자리에 유리, 온보딩·모달의 따뜻한 톤이 사라진다">
            <ul className="space-y-1.5 text-sm text-text-muted">
              <li>불러오는 중...</li>
              <li>조회 중...</li>
              <li>삭제 중...</li>
              <li>해제하는 중...</li>
            </ul>
          </Option>

          <Option label="C" note="자리로 분리 — 버튼·헤더처럼 좁으면 '~중...', 화면·모달처럼 넓으면 '~하고 있어요'">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-[10px] border border-border px-3 py-2">
                <span className="text-xs text-text-disabled">헤더</span>
                <span className="text-sm text-text-muted">조회 중...</span>
              </div>
              <button type="button" className={DANGER_BTN}>
                <MapleSpinner size={16} />
                삭제 중...
              </button>
              <div className="flex flex-col items-center gap-2 rounded-[10px] border border-border py-5">
                <MapleSpinner size={32} className="text-primary" />
                <span className="text-sm text-text-muted">체크리스트를 준비하고 있어요</span>
              </div>
            </div>
          </Option>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section
          code="S10"
          title="스피너를 몇 종 둘 것인가"
          current="트레일 링(MapleSpinner)만 배치됨 — 2026-07-22에 함께 채택한 드로잉형·펄스형은 배치처 없음"
        >
          <Option label="비교" note="왼쪽부터 트레일 링 / 드로잉형 / 펄스형 — 위 20px(버튼), 아래 32px(화면)">
            <div className="space-y-5">
              <div className="flex items-end justify-around text-primary">
                <div className="flex flex-col items-center gap-2">
                  <MapleSpinner size={20} />
                  <span className="text-[10px] text-text-muted">트레일 링</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MapleDrawSpinner size={20} />
                  <span className="text-[10px] text-text-muted">드로잉형</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <MaplePulseSpinner size={20} />
                  <span className="text-[10px] text-text-muted">펄스형</span>
                </div>
              </div>
              <div className="flex items-end justify-around text-primary">
                <MapleSpinner size={32} />
                <MapleDrawSpinner size={32} />
                <MaplePulseSpinner size={32} />
              </div>
            </div>
          </Option>

          <Option label="A" note="1종만 유지 — 비결정형은 전부 트레일 링, 드로잉형·펄스형은 폐기">
            <div className="flex items-center justify-around text-primary">
              <MapleSpinner size={20} />
              <MapleSpinner size={32} />
            </div>
          </Option>

          <Option label="B" note="크기로 2종 — 작은 자리(≤20px)는 트레일 링, 큰 자리(≥32px)는 드로잉형">
            <div className="flex items-center justify-around text-primary">
              <MapleSpinner size={20} />
              <MapleDrawSpinner size={32} />
            </div>
          </Option>

          <Option label="C" note="대기 길이로 2종 — 짧은 대기는 트레일 링, 긴 대기(시드·백필·캐시 삭제)는 펄스형">
            <div className="flex items-center justify-around text-primary">
              <MapleSpinner size={20} />
              <MaplePulseSpinner size={32} />
            </div>
          </Option>
        </Section>
      </div>
    </div>
  )
}
