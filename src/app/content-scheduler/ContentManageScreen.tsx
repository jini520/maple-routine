import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Castle, Flag, LayoutGrid, MapPin, Medal, Sparkles, Swords, type LucideIcon } from 'lucide-react'
import { CONTENT_TEMPLATE } from '../../lib/scheduler-content-template'
import { categorizeContentEntries, contentCountTag, WEEKLY_CATEGORY_ORDER } from '../../lib/content-category'
import { worldEmblemUrl } from '../../lib/world-emblem'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'

type ContentTab = 'daily' | 'weekly'

// 카테고리 → 아이콘은 표현 계층 결정이라 여기 둔다(카테고리 자체는 lib/content-category가 데이터에서 도출).
// 매핑에 없는 카테고리·접두사 없는 단독 항목은 Sparkles로 폴백한다.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  '일일 퀘스트': MapPin,
  '주간 퀘스트': MapPin,
  '에픽 던전': Castle,
  '메이플 유니온': LayoutGrid,
  몬스터파크: Swords,
  // 아케인리버 지역 퀘스트는 그룹화 전 단독 항목이 쓰던 기본 아이콘(Sparkles)을 그대로 유지(사용자 지시)
  '아케인리버 지역 퀘스트': Sparkles,
  무릉도장: Medal,
  길드: Flag,
}

function categoryIcon(label: string | null): LucideIcon {
  return (label !== null ? CATEGORY_ICON[label] : undefined) ?? Sparkles
}

// ADR-035 결정 18: 컨텐츠 관리 페이지(수동 추적 항목 편집). 템플릿 전체를 일간/주간 탭 체크리스트로 항상
// 보여주고 추적 중인 항목만 선택 상태로 그린다 — 추가·삭제가 행 탭(토글) 하나로 통일되고,
// 토글은 즉시 저장한다(로컬 Preferences 쓰기뿐이고 비파괴적이라 확인 버튼 없음). 대상 캐릭터는
// 컨텐츠 스케줄러에서 선택된 캐릭터를 승계한다. 수동 모드 전용 — 자동 모드 직접 진입은
// 스케줄러로 리다이렉트한다.
// 리디자인(2026-07-24, 와이어프레임 리뷰): content_name에 이미 있는 접두사(lib/content-category)로
// 카테고리 그룹핑 — 반복되는 "[일일 퀘스트] …"를 헤더로 한 번만 묶고 행에는 알맹이만 표시한다.
export function ContentManageScreen(): React.JSX.Element {
  const {
    characters,
    selectedOcid,
    manualTrackedByOcid,
    loadTrackedOcids,
    addManualContent,
    removeManualContent,
  } = useContentSchedulerStore()
  const { mode } = useTrackingModeStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ContentTab>('daily')

  // 스케줄러를 거치지 않고 직접 진입(새로고침 등)해도 스토어가 채워지도록 동일하게 로드한다.
  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (mode !== 'manual') {
    return <Navigate to="/content" replace />
  }

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null
  const worldEmblem = selected?.world != null ? worldEmblemUrl(selected.world) : null

  const trackedNames = new Set(
    (selected !== null ? (manualTrackedByOcid?.[selected.ocid] ?? []) : [])
      .filter((item) => item.kind === activeTab)
      .map((item) => item.contentName),
  )

  function handleToggle(contentName: string): void {
    if (selected === null) return
    if (trackedNames.has(contentName)) {
      void removeManualContent(selected.ocid, contentName, activeTab)
    } else {
      void addManualContent(selected.ocid, contentName, activeTab)
    }
  }

  return (
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 제목~탭까지 sticky로 상단에 고정하고 그 아래 항목 목록만 스크롤 — 스케줄러 화면과 동일
          패턴(UI_GUIDE "스크롤 영역"). AppShell의 pt-[--sa-top]을 -mt로 상쇄하고 pt-calc로
          노치까지 bg-bg가 덮게 한다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/content')}
                aria-label="뒤로"
                className="p-1 -ml-1 text-text-muted hover:text-text"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>
              <h1 className="text-lg font-semibold text-text">컨텐츠 관리</h1>
            </div>
            {selected !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted">
                {worldEmblem !== null && (
                  <img
                    src={worldEmblem}
                    alt={selected.world ?? ''}
                    className="h-3.5 w-auto shrink-0 object-contain"
                  />
                )}
                {selected.characterName}
              </span>
            )}
          </div>

          {selected !== null && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className={
                  activeTab === 'daily'
                    ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
                    : 'px-3 text-sm font-medium text-text-muted'
                }
              >
                일간
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weekly')}
                className={
                  activeTab === 'weekly'
                    ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
                    : 'px-3 text-sm font-medium text-text-muted'
                }
              >
                주간
              </button>
            </div>
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {selected === null ? (
        <div className="px-4 pb-4">
          <p className="text-sm text-text-muted">캐릭터를 먼저 선택해주세요 — 컨텐츠 스케줄러의 "캐릭터 관리"에서 추가할 수 있어요.</p>
        </div>
      ) : (
        <div className="space-y-4 px-4 pb-4">
            {categorizeContentEntries(
              CONTENT_TEMPLATE[activeTab],
              activeTab === 'weekly' ? WEEKLY_CATEGORY_ORDER : undefined,
            ).map((group, groupIndex) => {
              const GroupIcon = categoryIcon(group.label)
              const trackedCount = group.items.filter((item) =>
                trackedNames.has(item.entry.content_name),
              ).length
              return (
                <div key={group.label ?? `standalone-${groupIndex}`}>
                  {group.label !== null && (
                    <div className="flex items-center gap-2 px-1 pb-2 pt-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-third/15 text-third-text">
                        <GroupIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className="text-xs font-bold text-text">{group.label}</span>
                      <span className="ml-auto rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-muted tabular-nums">
                        {trackedCount}/{group.items.length}
                      </span>
                    </div>
                  )}
                  <ul className="space-y-2">
                    {group.items.map(({ entry, displayName }) => {
                      const isTracked = trackedNames.has(entry.content_name)
                      const tag = contentCountTag(entry, group.label)
                      return (
                        <li key={entry.content_name}>
                          <button
                            type="button"
                            aria-pressed={isTracked}
                            onClick={() => handleToggle(entry.content_name)}
                            className={
                              isTracked
                                ? 'flex w-full items-center gap-3 rounded-[10px] border border-primary bg-primary/15 px-4 py-3 text-left'
                                : 'flex w-full items-center gap-3 rounded-[10px] border border-border px-4 py-3 text-left hover:bg-primary/15'
                            }
                          >
                            <GroupIcon
                              className={
                                isTracked
                                  ? 'h-[18px] w-[18px] shrink-0 text-primary-text'
                                  : 'h-[18px] w-[18px] shrink-0 text-text-muted'
                              }
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                              {displayName}
                            </span>
                            {tag !== null && (
                              <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-muted">
                                {tag}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
