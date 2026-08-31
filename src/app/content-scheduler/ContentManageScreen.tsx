// 컨텐츠 관리 — 수동 추적 항목 편집([[ADR-035]] 결정 18).
//
// ══ RN 으로 옮기며 갈린 것 다섯 ═══════════════════════════════════════════════════
//
// ① **`StackScreen` 이 통째로 사라진다**([[ADR-120]]). 포털 오버레이·푸시/팝 전환·가장자리 스와이프·
//    탭바 밀어내기 넷이 전부 루트 스택의 성질이라, 셸은 `ScreenScroll(hasTabBar={false})` +
//    `PageHeader` 다(설정 하위 화면과 같은 골격).
// ② **`useStackBack(PARENT_PATH)` → `goBack()`**, 그래서 `PARENT_PATH` 상수도 사라진다 — 딥링크가
//    없어 *"돌아갈 곳이 없는 경우"* 가 존재하지 않는다(`app/use-screen-navigation.ts`).
// ③ **자동 모드 리다이렉트가 도달 불가능해졌다.** 웹의 `<Navigate to="/content" replace />` 는
//    **주소로 직접 들어오는 경로**를 막던 것인데(URL 이 있는 세계의 문제), RN 에서 이 화면에 오는
//    길은 수동 모드에서만 보이는 버튼 하나뿐이고 그 위에 덮여 있는 동안 설정 탭에 닿을 수도 없다.
//    그래도 **계약은 남긴다** — 모드가 바뀌면 물러난다. 비용이 effect 한 줄이고, 지우면 "왜 없어도
//    되는지"를 다음 사람이 다시 증명해야 한다.
// ④ `<button aria-pressed>` → `Pressable` + **`aria-selected`**(RN 접근성 상태에 *pressed* 가 없다 —
//    설정·온보딩의 선택 카드가 이미 밟은 자리).
// ⑤ **잠금 스크림에서 `backdrop-blur-[2px]` 가 빠진다**([[ADR-055]] 정정 1 의 표기 규칙 중 흐림 몫).
//    RN 에 `backdrop-filter` 가 없어 되붙일 방법이 없고, [[ADR-123]] 이 웹에서 그것을 걷어낸 뒤라
//    **방향도 같다.** 규칙의 본체("사유는 오른쪽 뱃지가 아니라 행 위를 덮는 한 줄")는 그대로다.
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { CONTENT_TEMPLATE } from '../../lib/scheduler-content-template'
import {
  categorizeContentEntries,
  contentCountTag,
  isGuildContent,
  WEEKLY_CATEGORY_ORDER,
} from '../../lib/content-category'
import { useContentSchedulerStore, type ContentTab } from '../../features/content-scheduler/store'
import { resolveSelectedCharacter } from '../../features/character-selection/selected-character'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { useToastStore } from '../../features/toast/store'

import { Text } from '../../components/atoms/Text/Text'
import { CharacterRail, type CharacterRailEntry } from '../../components/molecules/CharacterRail/CharacterRail'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import {
  ArrowLeftIcon,
  CastleIcon,
  FlagIcon,
  LayoutGridIcon,
  MapPinIcon,
  MedalIcon,
  SparklesIcon,
  SwordsIcon,
} from '../../lib/icons'
import { Badge } from '../../components/atoms/Badge/Badge'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { useScreenNavigation } from '../use-screen-navigation'

// 카테고리 → 아이콘은 표현 계층 결정이라 여기 둔다(카테고리 자체는 lib/content-category가 데이터에서 도출).
// 매핑에 없는 카테고리·접두사 없는 단독 항목은 Sparkles로 폴백한다.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  '일일 퀘스트': MapPinIcon,
  '주간 퀘스트': MapPinIcon,
  '에픽 던전': CastleIcon,
  '메이플 유니온': LayoutGridIcon,
  몬스터파크: SwordsIcon,
  // 아케인리버 지역 퀘스트는 그룹화 전 단독 항목이 쓰던 기본 아이콘(Sparkles)을 그대로 유지(사용자 지시)
  '아케인리버 지역 퀘스트': SparklesIcon,
  무릉도장: MedalIcon,
  길드: FlagIcon,
}

function categoryIcon(label: string | null): LucideIcon {
  return (label !== null ? CATEGORY_ICON[label] : undefined) ?? SparklesIcon
}

// ADR-035 결정 18: 컨텐츠 관리 페이지(수동 추적 항목 편집). 템플릿 전체를 일간/주간 탭 체크리스트로 항상
// 보여주고 추적 중인 항목만 선택 상태로 그린다 — 추가·삭제가 행 탭(토글) 하나로 통일되고,
// 토글은 즉시 저장한다(로컬 Preferences 쓰기뿐이고 비파괴적이라 확인 버튼 없음). 대상 캐릭터는
// 컨텐츠 스케줄러에서 선택된 캐릭터를 승계한다. 수동 모드 전용.
// 리디자인(2026-07-24, 와이어프레임 리뷰): content_name에 이미 있는 접두사(lib/content-category)로
// 카테고리 그룹핑 — 반복되는 "[일일 퀘스트] …"를 헤더로 한 번만 묶고 행에는 알맹이만 표시한다.
export function ContentManageScreen(): React.JSX.Element {
  const {
    status,
    characters,
    manualTrackedByOcid,
    loadTrackedOcids,
    addManualContent,
    removeManualContent,
    // ADR-096 결정 2: 진입 시점의 스케줄러 탭을 이어받는다(일간에서 들어오면 일간).
    activeTab: schedulerTab,
    // ADR-096 결정 4: 선택 캐릭터는 스케줄러와 공유한다 — 탭과 달리 "지금 누구를 보고 있는가"는
    // 두 화면이 갈라지면 안 되는 값이다.
  } = useContentSchedulerStore()
  // 선택은 화면·스토어가 아니라 **여기 한 벌**이다([[ADR-159]] 결정 1).
  const { selectedOcid, select } = useCharacterSelectionStore()
  const { mode } = useTrackingModeStore()
  const navigation = useScreenNavigation()
  // ADR-096 결정 2: 이어받는 것은 **진입 시점 한 번뿐**이고, 이 화면에서의 탭 전환은 스케줄러로
  // 되돌리지 않는다. 되돌리면 잠깐 다른 탭을 뒤져본 것 때문에 돌아갔을 때 보던 화면이 바뀌어,
  // 애초에 고치려던 문제("보던 자리를 잃는다")를 반대 방향으로 다시 만든다.
  const [activeTab, setActiveTab] = useState<ContentTab>(schedulerTab)

  // 스케줄러를 거치지 않고 직접 진입해도 스토어가 채워지도록 동일하게 로드한다.
  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 파일 머리 ③ — 웹 `<Navigate to="/content" replace />` 의 자리.
  useEffect(() => {
    if (mode !== 'manual') navigation.goBack()
  }, [mode, navigation])

  // 화면 넷이 **같은 규칙**으로 고른다([[ADR-159]] 결정 3) — 선택만 합치고 폴백을 화면마다 두면
  // «공유했는데 화면마다 다른 캐릭터» 가 다시 생긴다.
  const selected = resolveSelectedCharacter(selectedOcid, characters)

  // [[ADR-142]] 정정 8: 링 없는 초상화 레일 — 이름과 레벨만 싣는다(`rings: []`).
  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    rings: [],
  }))

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
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="justify-between">
            <View className="flex-row items-center gap-2">
              <Pressable role="button" aria-label="뒤로" onPress={() => navigation.goBack()} className="-ml-1 p-1">
                <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
              </Pressable>
              <Text className="text-lg font-semibold text-text">컨텐츠 관리</Text>
            </View>
            {/* ADR-096 결정 4·5: 읽기 전용 칩이던 자리 — 이 화면에서 캐릭터를 갈아 가며 쓰는데도
                바꾸려면 뒤로 나가야 했다. 자리와 크기감은 그대로 두고(compact) 누를 수 있게만 한다.
                onSelect는 스케줄러와 같은 selectCharacter라 돌아갔을 때 그쪽도 같은 캐릭터다. */}
          </PageHeaderTitleRow>

          {/* [[ADR-142]] 정정 8: 제목 줄 우측의 compact 드롭다운이 **초상화 레일**이 됐다(스케줄러와
              같은 컴포넌트). **여기에는 진행 링이 없다**(`rings: []`) — 이 화면의 일은 캐릭터를 고르는
              것이지 진행을 보는 것이 아니고, 링 자리를 비우면 글자가 얼굴 쪽으로 들어와 칸도 낮아진다.
              제목 줄에서 내려온 이유는 레일이 그 작은 자리에 안 들어가기 때문이다. */}
          {selected !== null && (
            <CharacterRail
              entries={railEntries}
              selectedOcid={selected.ocid}
              onSelect={(ocid) => {
                void select(ocid)
              }}
            />
          )}

          {selected !== null && (
            <View className="flex-row items-center gap-4">
              <Pressable role="button" aria-selected={activeTab === 'daily'} onPress={() => setActiveTab('daily')}>
                <Text
                  className={
                    activeTab === 'daily'
                      ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                      : 'px-3 text-sm font-medium text-text-muted'
                  }
                >
                  일간
                </Text>
              </Pressable>
              <Pressable role="button" aria-selected={activeTab === 'weekly'} onPress={() => setActiveTab('weekly')}>
                <Text
                  className={
                    activeTab === 'weekly'
                      ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                      : 'px-3 text-sm font-medium text-text-muted'
                  }
                >
                  주간
                </Text>
              </Pressable>
            </View>
          )}
        </PageHeader>
      }
    >
      <View testID="screen-ContentManage">
        {/* ADR-061 결정 10: 조회가 끝나기 전(idle·loading)에는 빈 상태 문구로 위장하지 않고
            로딩 카드를 그린다 — 확정된 빈 상태는 조회가 끝난 뒤에만 말할 수 있다([[ADR-060]]). */}
        {selected === null && (status === 'idle' || status === 'loading') ? (
          <View className="px-4 pb-4">
            <LoadingState size="page" message="불러오고 있어요" />
          </View>
        ) : selected === null ? (
          <View className="px-4 pb-4">
            <Text className="text-sm text-text-muted">
              캐릭터를 먼저 선택해주세요 — 컨텐츠 스케줄러의 "캐릭터 관리"에서 추가할 수 있어요.
            </Text>
          </View>
        ) : (
          <View className="gap-4 px-4 pb-4">
            {categorizeContentEntries(
              CONTENT_TEMPLATE[activeTab],
              activeTab === 'weekly' ? WEEKLY_CATEGORY_ORDER : undefined,
            ).map((group, groupIndex) => {
              const GroupIcon = categoryIcon(group.label)
              const trackedCount = group.items.filter((item) =>
                trackedNames.has(item.entry.content_name),
              ).length
              return (
                <View key={group.label ?? `standalone-${groupIndex}`}>
                  {group.label !== null && (
                    <View className="flex-row items-center gap-2 px-1 pb-2 pt-1">
                      <View className="h-6 w-6 items-center justify-center rounded-lg bg-third-tint">
                        <GroupIcon className="h-3.5 w-3.5 text-third-ink" strokeWidth={2} aria-hidden />
                      </View>
                      <Text className="text-xs font-bold text-text">{group.label}</Text>
                      <Badge variant="muted" style={TABULAR_NUMS} className="ml-auto">
                        {trackedCount}/{group.items.length}
                      </Badge>
                    </View>
                  )}
                  <View className="gap-2">
                    {group.items.map(({ entry, displayName }) => {
                      const isTracked = trackedNames.has(entry.content_name)
                      const isLocked = isGuildBlocked(entry.content_name)
                      const tag = contentCountTag(entry, group.label)
                      // 사유는 오른쪽 뱃지가 아니라 흐려진 행 위에 얹는 한 줄로 알린다 —
                      // 보스 관리 화면과 같은 규칙(사용자 피드백, [[ADR-055]] 정정 1).
                      return (
                        <View key={entry.content_name}>
                          <Pressable
                            role="button"
                            aria-selected={isTracked}
                            disabled={isLocked}
                            onPress={() => void handleToggle(entry.content_name)}
                            className={
                              isTracked
                                ? 'w-full flex-row items-center gap-3 rounded-[10px] border border-primary bg-primary-tint px-4 py-3'
                                : 'w-full flex-row items-center gap-3 rounded-[10px] border border-border px-4 py-3'
                            }
                          >
                            <GroupIcon
                              className={
                                isTracked
                                  ? 'h-[18px] w-[18px] shrink-0 text-primary-ink'
                                  : 'h-[18px] w-[18px] shrink-0 text-text-muted'
                              }
                              strokeWidth={2}
                              aria-hidden
                            />
                            <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-medium text-text">
                              {displayName}
                            </Text>
                            {tag !== null && (
                              <Badge variant="muted" className="shrink-0">
                                {tag}
                              </Badge>
                            )}
                          </Pressable>

                          {/* 보스 관리 화면과 같은 규칙 — 흐림은 콘텐츠 opacity가 아니라 그 위를
                              덮는 스크림이다. 이 행은 자체 배경이 없어 페이지 배경색(bg)으로 덮는다.
                              `backdrop-blur` 는 RN 에 없어 빠진다(파일 머리 ⑤). */}
                          {isLocked && (
                            <View
                              pointerEvents="none"
                              className="absolute inset-0 items-center justify-center rounded-[10px] bg-scrim px-4"
                            >
                              <Text className="text-sm font-semibold text-text">길드 가입 시 진행 가능</Text>
                            </View>
                          )}
                        </View>
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </ScreenScroll>
  )
}
