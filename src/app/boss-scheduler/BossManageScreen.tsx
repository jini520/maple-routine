/**
 * 보스 관리 화면. 추적 편집(수동)과 파티 인원 설정을 하는 스케줄 그룹의 하위 탭.
 *
 *
 * 행의 원형 `BossPortrait` 에는 프롭을 그대로 넘기기만 하고 계산을 갖지 않는다.
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import weeklyBossesData from '../../data/weekly-bosses.json'
import { partySizeKey, useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { BOSS_SECTION_ORDER } from '../../features/boss-scheduler/displayed-bosses'
import { resolveSelectedCharacter } from '../../features/character-selection/selected-character'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import { useToastStore } from '../../features/toast/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { getMaxPartySize } from '../../lib/boss/boss-crystal-prices'
import {
  countManualWeeklyBosses,
  getBossCycleByName,
  isSeasonBossName,
  WEEKLY_BOSS_CLEAR_LIMIT,
} from '../../lib/boss/boss-matching'
import { isChallengersWorld } from '../../lib/assets/asset-lookup'
import type { BossDifficulty } from '../../types'

import { Badge, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { CharacterRail, type CharacterRailEntry } from '../../components/organisms/CharacterRail/CharacterRail'
import { DifficultySegment } from '../../components/molecules/DifficultySegment/DifficultySegment'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PartySizeStepper } from '../../components/molecules/PartySizeStepper/PartySizeStepper'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'

interface BossReferenceEntry {
  boss: string
  difficulties: string[]
  portraitSlug?: string | null
  status?: string
}

interface BossListEntry {
  boss: string
  difficulties: BossDifficulty[]
  portraitSlug: string | null
}

// 목록은 게임 레퍼런스 데이터(`weekly-bosses.json`) 그대로다.
// 주간 탭은 주간(챌린저스 월드는 시즌 주간까지), 월간 탭은 월간이다.
// 난이도 후보도 같은 파일의 `difficulties` 를 쓴다.
// 출시되면 그 필드를 지우는 것만으로 돌아온다. 지금 걸리는 엔트리는 0개다.
// 미출시 보스(`status: 'unreleased'`)는 뺀다. 보스명을 코드에 안 박고 데이터로 거르므로
function toListEntries(entries: BossReferenceEntry[]): BossListEntry[] {
  return entries
    .filter((entry) => entry.status !== 'unreleased')
    .map((entry) => ({
      boss: entry.boss,
      difficulties: entry.difficulties as BossDifficulty[],
      portraitSlug: entry.portraitSlug ?? null,
    }))
}

const WEEKLY_BOSSES = toListEntries(weeklyBossesData.weekly as BossReferenceEntry[])
const SEASON_BOSSES = toListEntries(weeklyBossesData.eventWeekly as BossReferenceEntry[])
const MONTHLY_BOSSES = toListEntries(weeklyBossesData.monthly as BossReferenceEntry[])

// 수동 모드는 행 탭이 추적 토글이고 즉시 저장한다. 체크된 행에만 난이도와 스테퍼가 펼쳐진다.
// 자동 모드는 체크 없이 파티 인원만 설정하고, 미등록 보스도 미리 설정할 수 있다.
// 행은 두 줄이다. 첫 줄이 초상 + 보스명 + 파티 스테퍼, 둘째 줄이 난이도 세그먼트다.
export function BossManageScreen(): React.JSX.Element {
  const {
    status,
    characters,
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    setPartySize,
    addManualBoss,
    removeManualBoss,
    setManualBossDifficulty,
    // 선택 캐릭터는 스케줄러와 공유한다. 두 화면이 갈라지면 안 된다.
  } = useBossSchedulerStore()
  // 선택한 캐릭터는 앱 전체가 한 벌로 든다.
  const { selectedOcid, select } = useCharacterSelectionStore()
  const { mode } = useTrackingModeStore()
  // 방향이 뒤집혀 읽힌다.
  // 스위치는 `모든 보스 보기`(기본 꺼짐)다. `거른다` 를 뜻하는 스위치는 끄면 더 보인다가 되어
  const [showAllBosses, setShowAllBosses] = useState(false)
  // 아니라 저장하지 않는다.
  // 자동 모드에서 행마다 어느 난이도의 파티 인원을 편집 중인지 담는 화면 전용 상태. 멤버십이
  const [autoDifficultyByBoss, setAutoDifficultyByBoss] = useState<Record<string, BossDifficulty>>({})

  // 스케줄러를 거치지 않고 직접 진입해도 스토어가 채워지도록 동일하게 로드한다.
  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 화면 넷이 **같은 규칙**으로 고른다. 폴백을 화면마다 두면 공유했는데 화면마다 다른 캐릭터가 된다.
  const selected = resolveSelectedCharacter(selectedOcid, characters)

  // 링 없는 초상화 레일. 이름과 레벨만 싣는다(`rings: []`).
  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    rings: [],
  }))

  // 등록 난이도 조회. 난이도 기본 선택(등록 난이도 우선)과 자동 모드의 "등록된 보스만 보기"에 쓴다.
  const registeredDifficultyByBoss = new Map<string, BossDifficulty>()
  if (selected !== null) {
    for (const boss of [...selected.weeklyBosses, ...selected.monthlyBosses]) {
      if (boss.isRegistered) {
        registeredDifficultyByBoss.set(boss.matchedBossName ?? boss.apiName, boss.difficulty)
      }
    }
  }

  const trackedBossItems =
    selected !== null
      ? (manualTrackedByOcid?.[selected.ocid] ?? []).filter((item) => item.kind === 'boss')
      : []

  function trackedDifficultyOf(bossName: string): BossDifficulty | null {
    const item = trackedBossItems.find((candidate) => candidate.contentName === bossName)
    return item !== undefined ? ((item.difficulty ?? null) as BossDifficulty | null) : null
  }

  function defaultDifficultyFor(bossName: string, difficulties: BossDifficulty[]): BossDifficulty | null {
    return registeredDifficultyByBoss.get(bossName) ?? difficulties[0] ?? null
  }

  // 12는 주간 한도이고 시즌 보스는 예외다. 카운트 규칙은 `lib/boss/boss-matching` 한 곳에만 있다.
  const weeklyTrackedCount = countManualWeeklyBosses(trackedBossItems)
  const isWeeklyLimitReached = mode === 'manual' && weeklyTrackedCount >= WEEKLY_BOSS_CLEAR_LIMIT

  function countsTowardWeeklyLimit(bossName: string): boolean {
    return getBossCycleByName(bossName) === 'weekly' && !isSeasonBossName(bossName)
  }

  // 비-챌린저스로 본다. 판정은 스케줄러 화면과 같은 함수여야 한다.
  // 시즌 보스는 챌린저스 월드 전용이라 그 월드 캐릭터에게만 보인다. 월드를 모르는 구버전 캐시는
  const showsSeasonBosses = selected?.world !== undefined && isChallengersWorld(selected.world)
  // **무리 둘이고 월간이 위다.** 스케줄러 목록과 같은 순서여야 보는 화면과 편집 화면이 같아진다.
  const allSections = BOSS_SECTION_ORDER.map((cycle) => ({
    cycle,
    entries:
      cycle === 'monthly'
        ? MONTHLY_BOSSES
        : showsSeasonBosses
          ? [...WEEKLY_BOSSES, ...SEASON_BOSSES]
          : WEEKLY_BOSSES,
  }))
  // 자동 모드 기본은 등록된 보스만이다. 등록이 하나도 없으면(신규 캐릭터) 전체 목록으로
  // 대체해 미등록 보스의 파티 인원을 미리 설정할 수 있게 한다.
  //
  // 합쳐 센 값이라, 검마만 등록한 캐릭터의 주간 무리가 등록 0이니 전체 목록으로 부풀지 않는다.
  // **판정은 무리별이 아니라 목록 전체로 한다.** `registeredDifficultyByBoss.size` 가 두 무리를
  const showsRegisteredOnly =
    mode === 'auto' && !showAllBosses && registeredDifficultyByBoss.size > 0
  const visibleSections = allSections
    .map((section) => ({
      ...section,
      entries: showsRegisteredOnly
        ? section.entries.filter((entry) => registeredDifficultyByBoss.has(entry.boss))
        : section.entries,
    }))
    // 없으면 보여 줄 이유도 없다.
    // 무리가 비면 헤더도 안 선다. `주간` 헤더의 `n/12` 는 수동 모드에서 고른 개수라, 고를 행이
    .filter((section) => section.entries.length > 0)

  // 저장 실패를 토스트로 알린다. 안 알리면 체크가 조용히 되돌아가는 것 외에 설명이 없다.
  async function handleToggleTracked(bossName: string, difficulties: BossDifficulty[]): Promise<void> {
    if (selected === null) return
    const trackedDifficulty = trackedDifficultyOf(bossName)
    if (trackedDifficulty !== null) {
      try {
        await removeManualBoss(selected.ocid, bossName, trackedDifficulty)
      } catch {
        useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
      }
      return
    }
    const difficulty = defaultDifficultyFor(bossName, difficulties)
    if (difficulty === null) return
    // 안내이고, `error` 는 자동 소멸이 없어 사용자가 직접 닫아야 한다.
    // 한도 초과는 행을 막지 않고 눌렀을 때 토스트로 알린다. `showInfo` 다. 실패가 아니라 규칙
    try {
      const result = await addManualBoss(selected.ocid, bossName, difficulty)
      if (result === 'limitReached') {
        useToastStore.getState().showInfo(`주간 ${WEEKLY_BOSS_CLEAR_LIMIT}개를 모두 선택했어요`)
      }
    } catch {
      useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
    }
  }

  // remove → add 2단계는 커밋이 2회라 그 사이에 보스가 목록에 없는 상태가 실재했다.
  // 수동 모드의 난이도 변경은 멤버십 교체다. 스토어의 단일 액션이 쓰기 1회로 끝낸다.
  async function handleSwitchDifficulty(bossName: string, to: BossDifficulty): Promise<void> {
    if (selected === null) return
    try {
      await setManualBossDifficulty(selected.ocid, bossName, to)
    } catch {
      useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
    }
  }

  async function handleSetPartySize(
    bossName: string,
    difficulty: BossDifficulty,
    partySize: number,
  ): Promise<void> {
    if (selected === null) return
    try {
      await setPartySize(selected.ocid, bossName, difficulty, partySize)
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했습니다')
    }
  }

  // 에 묻는다.
  // 콤팩트 스테퍼. 상한은 (보스, 난이도)마다 다르다. 화면이 숫자를 정하지 않고 `getMaxPartySize`
  function renderPartyStepper(bossName: string, difficulty: BossDifficulty): React.JSX.Element {
    const ocid = selected?.ocid ?? ''
    const value = partySizes[partySizeKey(ocid, bossName, difficulty)] ?? 1
    return (
      <PartySizeStepper
        size="compact"
        label={bossName}
        value={value}
        max={getMaxPartySize(bossName, difficulty)}
        onChange={(next) => void handleSetPartySize(bossName, difficulty, next)}
      />
    )
  }

  return (
    <ScreenScroll
      header={
        // 제목과 토글도 목록과 **함께 스크롤된다.** 헤더가 `ScreenScroll` 의 첫 자식이다.
        <PageHeader>
          {/* **← 가 없다.** 하위 페이지가 아니라 스케줄 그룹의 하위 탭이라 pop 할 스택이 없고,
              뒤로 가는 일은 하단바가 진다.

              줄이 제목 하나뿐이어도 `PageHeaderTitleRow` 를 쓴다. 그 최소 높이가 곧 옆 탭과
              같은 선이고, 빼면 보스 스케줄러와 2px 어긋난다. */}
          <PageHeaderTitleRow>
            <Text className="text-lg font-semibold text-text">보스 관리</Text>
          </PageHeaderTitleRow>

          {/* 제목 줄 우측이 초상화 레일이다. **여기에는 진행 링이 없다**(`rings: []`).
              이 화면의 일은 캐릭터를 고르는 것이지 진행을 보는 것이 아니다. */}
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
            <>
              {/* 자동 모드 안내 문구는 두지 않는다. 화면이 이미 그것을 보여 준다(체크가 없고
                  스테퍼만 있다). 설명은 기능 안내가 진다. */}
              {/* `n/12` 카운터는 `주간` 섹션 헤더가 싣는다. */}

              {mode === 'auto' && (
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-xs font-medium text-text-muted">모든 보스 보기</Text>
                  <Pressable
                    role="switch"
                    aria-checked={showAllBosses}
                    aria-label="모든 보스 보기"
                    onPress={() => setShowAllBosses((prev) => !prev)}
                    className={`relative h-6 w-11 shrink-0 rounded-full ${
                      showAllBosses ? 'bg-primary' : 'bg-surface-2'
                    }`}
                  >
                    <View
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface ${
                        showAllBosses ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </PageHeader>
      }
    >
      <View testID="screen-BossManage">
        {/* 조회가 끝나기 전(idle·loading)에는 빈 상태 문구로 위장하지 않는다. */}
        {selected === null && (status === 'idle' || status === 'loading') ? (
          <View className="px-4 pb-4">
            <LoadingState size="page" message="불러오고 있어요" />
          </View>
        ) : selected === null ? (
          <View className="px-4 pb-4">
            <Text className="text-sm text-text-muted">
              캐릭터를 먼저 선택해주세요. 보스 스케줄러의 "캐릭터 관리"에서 추가할 수 있어요.
            </Text>
          </View>
        ) : (
          <View className="gap-2 px-4 pb-4">
            {visibleSections.map((section) => (
              <View key={section.cycle} className="gap-2">
                {/* 스케줄러 헤더와 같은 모양을 쓴다. 두 화면의 무리 머리가 갈리면 같은 목록으로
                    안 읽힌다. 시즌 배지는 없다. 그것은 진행이고 이 화면은 편집이다. */}
                <View
                  testID={`boss-section-header-${section.cycle}`}
                  className="flex-row items-center justify-between gap-2"
                >
                  <Text className="text-sm font-semibold text-text">
                    {section.cycle === 'weekly' ? '주간' : '월간'}
                  </Text>
                  {mode === 'manual' && section.cycle === 'weekly' && (
                    <Badge variant="primary">
                      {weeklyTrackedCount}/{WEEKLY_BOSS_CLEAR_LIMIT}
                    </Badge>
                  )}
                </View>
                {section.entries.map((entry) => {
              const trackedDifficulty = mode === 'manual' ? trackedDifficultyOf(entry.boss) : null
              const isTracked = trackedDifficulty !== null

              // 한도가 찼을 때 미선택 행은 흐리게만 둔다. 비활성화하면 이유를 알릴 수 없다.
              const isLimitBlocked =
                mode === 'manual' &&
                !isTracked &&
                isWeeklyLimitReached &&
                countsTowardWeeklyLimit(entry.boss)

              // 자동 모드의 행 난이도: 화면 전용 선택 → 등록 난이도 → 첫 난이도 순.
              const autoDifficulty =
                autoDifficultyByBoss[entry.boss] ?? defaultDifficultyFor(entry.boss, entry.difficulties)

              // 스테퍼·난이도가 펼쳐지는 활성 난이도: 수동은 추적 난이도, 자동은 행 난이도.
              const activeDifficulty = mode === 'manual' ? trackedDifficulty : autoDifficulty
              const isExpanded = mode === 'auto' || isTracked

              // 함께 흐려져 안 읽힌다.
              // 흐림은 행 컨테이너가 아니라 안쪽 내용에만 건다. 컨테이너에 걸면 위에 얹는 안내까지
              const rowClassName =
                mode === 'manual' && isTracked
                  ? 'rounded-[14px] border border-primary bg-primary-tint'
                  : isLimitBlocked
                    ? 'rounded-[14px] border border-border bg-surface opacity-40'
                    : 'rounded-[14px] border border-border bg-surface'

              const nameContent = (
                <>
                  <View aria-hidden>
                    <BossPortrait portraitSlug={entry.portraitSlug} label={entry.boss} size={44} />
                  </View>
                  <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-semibold text-text">
                    {entry.boss}
                  </Text>
                </>
              )

              return (
                <View key={entry.boss} className={rowClassName}>
                  {/* 1번째 줄: 초상화 + 보스명(수동은 추적 토글 버튼) + 파티 스테퍼(우상단) */}
                  <View className="flex-row items-center gap-3 px-3 py-2.5">
                    {mode === 'manual' ? (
                      <Pressable
                        role="button"
                        aria-selected={isTracked}
                        aria-label={entry.boss}
                        onPress={() => void handleToggleTracked(entry.boss, entry.difficulties)}
                        className="min-w-0 flex-1 flex-row items-center gap-3"
                      >
                        {nameContent}
                      </Pressable>
                    ) : (
                      <View className="min-w-0 flex-1 flex-row items-center gap-3">{nameContent}</View>
                    )}
                    {activeDifficulty !== null && renderPartyStepper(entry.boss, activeDifficulty)}
                  </View>

                  {/* 2번째 줄: 난이도 세그먼트 */}
                  {isExpanded && (
                    <View className="flex-row flex-wrap items-center gap-2 border-t border-border px-3 pb-2.5 pt-2.5">
                      {mode === 'manual' && trackedDifficulty !== null ? (
                        <DifficultySegment
                          difficulties={entry.difficulties}
                          selected={trackedDifficulty}
                          onSelect={(difficulty) => void handleSwitchDifficulty(entry.boss, difficulty)}
                        />
                      ) : (
                        <DifficultySegment
                          difficulties={entry.difficulties}
                          selected={autoDifficulty}
                          onSelect={(difficulty) =>
                            setAutoDifficultyByBoss((prev) => ({ ...prev, [entry.boss]: difficulty }))
                          }
                        />
                      )}
                    </View>
                  )}
                </View>
              )
                })}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScreenScroll>
  )
}
