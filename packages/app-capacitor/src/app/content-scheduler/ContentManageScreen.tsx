import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, Castle, Flag, LayoutGrid, MapPin, Medal, Sparkles, Swords, type LucideIcon } from 'lucide-react'
import { CONTENT_TEMPLATE } from '@core/lib/scheduler-content-template'
import {
  categorizeContentEntries,
  contentCountTag,
  isGuildContent,
  WEEKLY_CATEGORY_ORDER,
} from '@core/lib/content-category'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { CharacterSelectDropdown } from '../../components/molecules/CharacterSelectDropdown/CharacterSelectDropdown'
import { useContentSchedulerStore, type ContentTab } from '@core/features/content-scheduler/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { useToastStore } from '@core/features/toast/store'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { useStackBack } from '@core/lib/use-stack-back'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'

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
// 부모 탭 — 딥링크로 이 화면에 직접 들어왔을 때 뒤로가 갈 곳([[ADR-120]] 결정 9).
const PARENT_PATH = '/content'

export function ContentManageScreen(): React.JSX.Element {
  const {
    status,
    characters,
    selectedOcid,
    manualTrackedByOcid,
    loadTrackedOcids,
    addManualContent,
    removeManualContent,
    // ADR-096 결정 2: 진입 시점의 스케줄러 탭을 이어받는다(일간에서 들어오면 일간).
    activeTab: schedulerTab,
    // ADR-096 결정 4: 선택 캐릭터는 스케줄러와 공유한다 — 탭과 달리 "지금 누구를 보고 있는가"는
    // 두 화면이 갈라지면 안 되는 값이다.
    selectCharacter,
  } = useContentSchedulerStore()
  const { mode } = useTrackingModeStore()
  // 화면을 통째로 바꾸는 이동은 이동 전에 스크롤을 최상단으로 옮긴다([[ADR-098]] 결정 1).
  const goBack = useStackBack(PARENT_PATH)
  // ADR-096 결정 2: 이어받는 것은 **진입 시점 한 번뿐**이고, 이 화면에서의 탭 전환은 스케줄러로
  // 되돌리지 않는다. 되돌리면 잠깐 다른 탭을 뒤져본 것 때문에 돌아갔을 때 보던 화면이 바뀌어,
  // 애초에 고치려던 문제("보던 자리를 잃는다")를 반대 방향으로 다시 만든다.
  const [activeTab, setActiveTab] = useState<ContentTab>(schedulerTab)

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

  const trackedNames = new Set(
    (selected !== null ? (manualTrackedByOcid?.[selected.ocid] ?? []) : [])
      .filter((item) => item.kind === activeTab)
      .map((item) => item.contentName),
  )

  // ADR-065 결정 4: 전에는 void로 프로미스를 버려 저장 실패가 무음이었다 — 체크가 조용히
  // 되돌아가는 것 외에 설명이 없었다. 체크박스가 그 자리에 남으므로 토스트로 알린다.
  async function handleToggle(contentName: string): Promise<void> {
    if (selected === null) return
    try {
      if (trackedNames.has(contentName)) {
        await removeManualContent(selected.ocid, contentName, activeTab)
      } else {
        await addManualContent(selected.ocid, contentName, activeTab)
      }
    } catch {
      useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
    }
  }

  // ADR-057: null일 때만 "가입한 길드 없음"이다. undefined(구버전 캐시·응답에 필드 없음)는
  // "모름"이라 잠그지 않는다 — 모름을 미가입으로 취급하면 멀쩡한 사용자의 길드 콘텐츠가 막힌다.
  const hasNoGuild = selected?.guildName === null

  // 이미 추적 중인 항목은 잠그지 않는다 — 길드를 나가도 해제할 수 있어야 한다([[ADR-057]] 결정 5).
  function isGuildBlocked(contentName: string): boolean {
    return !trackedNames.has(contentName) && hasNoGuild && isGuildContent(contentName)
  }

  return (
    // ADR-099: 스크롤의 소유자가 문서가 아니라 이 화면이다 — 스케줄러에서 스크롤을 내린 채 들어오는
    // 화면이라 같은 노출을 가졌었다. 공용 셸이 스크롤포트 인셋과 그 보정을 갖는다.
    <StackScreen parentPath={PARENT_PATH}>
      {/* 제목~탭까지 sticky로 상단에 고정하고 그 아래 항목 목록만 스크롤 — 스케줄러 화면과 동일
          패턴(UI_GUIDE "스크롤 영역"). AppShell의 pt-[--sa-top]을 -mt로 상쇄하고 pt-calc로
          노치까지 bg-bg가 덮게 한다. */}
      <PageHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="p-1 -ml-1 text-text-muted hover:text-text"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <h1 className="text-lg font-semibold text-text">컨텐츠 관리</h1>
          </div>
          {/* ADR-096 결정 4·5: 읽기 전용 칩이던 자리 — 이 화면에서 캐릭터를 갈아 가며 쓰는데도
              바꾸려면 뒤로 나가야 했다. 자리와 크기감은 그대로 두고(compact) 누를 수 있게만 한다.
              onSelect는 스케줄러와 같은 selectCharacter라 돌아갔을 때 그쪽도 같은 캐릭터다. */}
          {selected !== null && (
            <CharacterSelectDropdown
              characters={characters}
              selectedOcid={selected.ocid}
              onSelect={(ocid) => {
                void selectCharacter(ocid)
              }}
              size="compact"
            />
          )}
        </div>

        {selected !== null && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={
                activeTab === 'daily'
                  ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
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
                  ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                  : 'px-3 text-sm font-medium text-text-muted'
              }
            >
              주간
            </button>
          </div>
        )}
      </PageHeader>

      {/* ADR-061 결정 10: 조회가 끝나기 전(idle·loading)에는 빈 상태 문구로 위장하지 않고
          로딩 카드를 그린다 — 확정된 빈 상태는 조회가 끝난 뒤에만 말할 수 있다([[ADR-060]]). */}
      {selected === null && (status === 'idle' || status === 'loading') ? (
        <div className="px-4 pb-4">
          <LoadingState size="page" message="불러오고 있어요" />
        </div>
      ) : selected === null ? (
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
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-third-tint text-third-ink">
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
                      const isLocked = isGuildBlocked(entry.content_name)
                      const tag = contentCountTag(entry, group.label)
                      // 사유는 오른쪽 뱃지가 아니라 흐려진 행 위에 얹는 한 줄로 알린다 —
                      // 보스 관리 화면과 같은 규칙(사용자 피드백, [[ADR-055]] 정정 1).
                      return (
                        <li key={entry.content_name} className={isLocked ? 'relative' : undefined}>
                          <button
                            type="button"
                            aria-pressed={isTracked}
                            disabled={isLocked}
                            onClick={() => void handleToggle(entry.content_name)}
                            className={
                              isTracked
                                ? 'flex w-full items-center gap-3 rounded-[10px] border border-primary bg-primary-tint px-4 py-3 text-left'
                                : isLocked
                                  ? 'flex w-full items-center gap-3 rounded-[10px] border border-border px-4 py-3 text-left'
                                  : 'flex w-full items-center gap-3 rounded-[10px] border border-border px-4 py-3 text-left hover:bg-primary-tint'
                            }
                          >
                            <GroupIcon
                              className={
                                isTracked
                                  ? 'h-[18px] w-[18px] shrink-0 text-primary-ink'
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

                          {/* 보스 관리 화면과 같은 규칙 — 흐림은 콘텐츠 opacity가 아니라 그 위를
                              덮는 스크림이다. 이 행은 자체 배경이 없어 페이지 배경색(bg)으로 덮는다. */}
                          {isLocked && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[10px] bg-scrim px-4 backdrop-blur-[2px]">
                              <span className="text-sm font-semibold text-text">길드 가입 시 진행 가능</span>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
        </div>
      )}
    </StackScreen>
  )
}
