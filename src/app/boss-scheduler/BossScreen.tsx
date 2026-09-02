/**
 * 보스 스케줄러 화면. 주간·월간 보스 진행 상태를 캐릭터별로 그리는 탭.
 *
 * @see docs/features/boss-scheduler.md 완료 승격 · 시즌 판정 · 빈 상태 정책
 */
import { isBossBlocked } from '../../lib/scheduler/required-level'
import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import type { BossDifficulty } from '../../types'
import {
  partySizeKey,
  useBossSchedulerStore,
  type PartyFilter,
} from '../../features/boss-scheduler/store'
import {
  displayedBosses,
  displayedBossSections,
  type DisplayedBoss,
} from '../../features/boss-scheduler/displayed-bosses'
import { resolveSelectedCharacter } from '../../features/character-selection/selected-character'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '../../features/schedule-sync/use-sync-error-toast'
import { useToastStore } from '../../features/toast/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { getBossPortraitCrop, getBossPortraitUrl, isChallengersWorld } from '../../lib/assets/asset-lookup'
import type { ImageCrop } from '../../lib/image-crop'
import { getSupportedDifficulties, type MatchedBoss } from '../../lib/boss/boss-matching'
import { getMaxPartySize } from '../../lib/boss/boss-crystal-prices'

import {
  Badge,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  SwordsIcon,
  Text,
  UsersIcon,
} from '../../components/atoms'
import { CharacterRail, type CharacterRailEntry } from '../../components/organisms/CharacterRail/CharacterRail'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { IllustratedCard, FadedIllustration } from '../../components/molecules/FadedIllustration/FadedIllustration'
import { PartySizeModal } from '../../components/organisms/PartySizeModal/PartySizeModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../constants/style/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { ILLUSTRATION_TEXT_SHADOW_STYLE } from '../../constants/style/text-styles'
import { useTopSafeAreaPx } from '../../lib/safe-area'
import { orderByTracked } from '../../lib/scheduler/tracked-order'
import { useThemeAppearance } from '../../theme/context'
import { useOpenTab } from '../use-open-tab'
import { usePullRefresh } from '../use-pull-refresh'

const PARTY_FILTER_LABELS: Record<PartyFilter, string> = {
  all: '전체',
  solo: '솔로',
  party: '파티',
}

function BossCard(props: {
  boss: DisplayedBoss
  crop?: ImageCrop
  partySize?: number
  /** 요구 레벨 미달 여부. 참이면 완료 자리를 진행 불가 배지가 대신한다. */
  isBlocked?: boolean
  onEdit: () => void
}): React.JSX.Element {
  const { boss, partySize } = props
  const portraitUrl = getBossPortraitUrl(boss.portraitSlug)
  const crop = props.crop ?? getBossPortraitCrop(boss.portraitSlug)
  const bossName = boss.matchedBossName ?? boss.apiName

  // 카드 배경·테두리·보스명은 페이지 표면이 아니라 일러스트 위 배색을 따른다.
  // bleed·페이드·text-shadow 가 어두운 배경을 전제로 맞춰져 있어서다.
  // 페이지 토큰(`bg-surface`)을 쓰면 대비가 깨진다. `IllustratedCard` 가 기준 표면을 바꾸므로 그
  // 안에서는 앱 전역 레시피(`bg-surface-2`·`text-text`)를 그대로 쓴다.
  // 카드 전면(80px)이 버튼이다. 어포던스 표식을 두지 않고 눌림 피드백만 준다.
  return (
    <Pressable
      role="button"
      aria-label={`${bossName} 파티 설정`}
      onPress={props.onEdit}
      // NativeWind 가 `brightness-*` 를 안 내보내 축소만 남는다.
      className="rounded-[14px] active:scale-[.985]"
    >
      <IllustratedCard className="relative h-20 overflow-hidden">
        <FadedIllustration source={portraitUrl} crop={crop} />

        <View className="h-full flex-row items-center justify-between px-[14px]">
          <View className="flex-row items-center gap-2">
            <Badge variant={boss.difficulty}>
              {boss.difficulty}
            </Badge>
            <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
              {bossName}
            </Text>
            {partySize !== undefined && partySize > 1 && (
              <View className="flex-row items-center gap-1 rounded-full bg-surface-2 px-2 py-1">
                <UsersIcon className="h-3 w-3 text-text" strokeWidth={2} aria-hidden />
                <Text className="text-xs font-semibold text-text">{partySize}인</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-1.5">
            {/* 진행할 수 없는 보스의 완료 여부는 게임이 준 스냅샷이지 이 캐릭터가 잡을 수 있다는
                뜻이 아니다. 주간 한도를 채운 보스는 `마감`이고 **완료로 칠하지 않는다.** 안 잡은
                보스를 완료로 두면 그 거짓이 보스 수익의 결정석 금액이 된다.
                우선순위는 `진행 불가` → `마감` → `완료` 다. */}
            {props.isBlocked === true ? (
              <Badge variant="muted" fixed className="shrink-0">진행 불가</Badge>
            ) : boss.isWeeklyLimitClosed ? (
              // **완료와 같은 상자다.** 자리를 대신하는 배지라 크기가 다르면 카드 오른쪽 끝이
              // 흔들린다. 갈리는 것은 색뿐이다.
              <Badge variant="muted" weight="bold">
                마감
              </Badge>
            ) : (
              boss.isComplete && (
                <Badge variant="secondary">완료</Badge>
              )
            )}
          </View>
        </View>
      </IllustratedCard>
    </Pressable>
  )
}

export function BossScreen(): React.JSX.Element {
  const {
    status,
    characters: storeCharacters,
    error,
    trackedOcids,
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    refresh,
    // 카드 탭 모달이 쓰는 두 액션. 난이도 교체는 수동 모드에서만 멤버십을 바꾼다.
    setPartySize,
    setManualBossDifficulty,
    // 탭과 필터는 스토어 소유다. 이 화면이 언마운트돼도 살아남고, 관리 페이지가 같은 탭 값을 읽는다.
    partyFilter,
    setPartyFilter,
  } = useBossSchedulerStore()
  // 선택한 캐릭터는 앱 전체가 한 벌로 든다.
  const { selectedOcid, select } = useCharacterSelectionStore()
  // **당김이 시작한 회차에만** 인디케이터가 돈다. 헤더 버튼과 자동 조회는 안 연다.
  const pull = usePullRefresh(() => refresh(trackedOcids ?? []))
  const { mode } = useTrackingModeStore()
  const openTab = useOpenTab()
  const topSafeAreaPx = useTopSafeAreaPx()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()
  // 카드 탭으로 여는 파티 인원 모달. 편집 중인 난이도를 함께 든다.
  const [partyModal, setPartyModal] = useState<{ boss: MatchedBoss; difficulty: BossDifficulty } | null>(null)
  // 동기화 전체 실패는 토스트로 알린다. 지속 상태는 새로고침 옆 표기가 이미 진다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `null` 은 0명이 아니라 **저장소를 아직 안 읽었다** 다. `||` 로 묶으면 첫 페인트가 모르는
  // 빈 상태는 읽고 0명임을 **확인한 뒤에만** 그린다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

  // 스토어가 내는 것은 기준 순서(레벨 내림차순)이고 화면 순서는 캐릭터 관리에서 정한 배열이다.
  const characters = orderByTracked(storeCharacters, trackedOcids ?? [])

  // 화면 넷이 **같은 규칙**으로 고른다. 폴백을 화면마다 두면 공유했는데 화면마다 다른 캐릭터가 된다.
  const selected = resolveSelectedCharacter(selectedOcid, characters)

  // 반환하므로 실패의 대부분이 전역 error 가 아니라 이 값으로 온다. 둘이 동시에 울릴 조합은 없다.
  // 캐릭터별 실패도 토스트다. `syncSchedules` 는 캐릭터 단위 실패를 던지지 않고 결과에 실어
  useScheduleSyncErrorToast(selected?.error ?? null, { onRetry: () => refresh(trackedOcids ?? []) })

  // 카드로 그릴 목록. 판정은 `displayed-bosses` 가 갖는다. today 가 세는 남은 보스와 한 글자도
  //
  // **순서는 여기서 정하지 않는다.** `displayedBossSections` 가 정한 순서대로 그린다.
  const sections =
    selected === null ? [] : displayedBossSections(selected, mode, manualTrackedByOcid)

  // 솔로·파티 필터는 안 탄다. 필터는 지금 보고 싶은 것이지 진행이 아니다.
  //
  //
  // 마감은 이번 주 일이 끝난 것이라, 12마리를 추적했으면 링이 `12/12` 로 읽혀야 한다.
  // **요구 레벨 미달은 분모에서 빠지고 마감은 분자에 든다.** 미달은 이 캐릭터의 일이 아니고
  // 링은 **주간 하나**다. 월간은 종류가 하나뿐이라 몇 개 중 몇 개가 뜻을 못 갖는다.
  const bossRingProgress = (
    bosses: DisplayedBoss[],
    characterLevel: number | null,
  ): { completed: number; total: number } => {
    const progressible = bosses.filter(
      (boss) => !isBossBlocked(characterLevel, boss.matchedBossName ?? boss.apiName, boss.difficulty),
    )
    return {
      completed: progressible.filter((boss) => boss.isComplete || boss.isWeeklyLimitClosed).length,
      total: progressible.length,
    }
  }

  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    rings: [
      {
        label: '주간',
        ...bossRingProgress(
          displayedBosses(character, 'weekly', mode, manualTrackedByOcid),
          character.level ?? null,
        ),
      },
    ],
  }))

  // `isChallengersWorld` 가 하고 화면이 월드 이름을 다시 뜯지 않는다. 관리 페이지와 같은 함수다.
  // 챌린저스 월드면 등록 여부와 무관하게 시즌 보스 완료를 배지로 보인다. 판정은
  const seasonBosses =
    selected !== null && selected.world !== undefined && isChallengersWorld(selected.world)
      ? selected.weeklyBosses.filter((boss) => boss.isSeasonBoss)
      : []
  const isSeasonBossComplete = seasonBosses.some((boss) => boss.isComplete)

  function getPartySize(ocid: string, boss: MatchedBoss): number | undefined {
    const bossName = boss.matchedBossName ?? boss.apiName
    return partySizes[partySizeKey(ocid, bossName, boss.difficulty)]
  }

  // `boss_party_settings` 에 없는 조합은 솔로(1인)로 본다.
  // 이미 로드된 `partySizes` 맵으로만 거른다.
  // 원소 타입을 안 좁힌다. 거르기만 하는 함수라 `DisplayedBoss` 가 들어오면 그대로 나가야 한다.
  function filterByPartySize<T extends MatchedBoss>(bosses: T[], ocid: string, filter: PartyFilter): T[] {
    if (filter === 'all') return bosses
    return bosses.filter((boss) => {
      const size = getPartySize(ocid, boss) ?? 1
      return filter === 'party' ? size >= 2 : size <= 1
    })
  }

  // 필터를 건 뒤에야 **비었다** 가 성립한다. 그래서 빈 무리를 걷는 것이 여기다.
  const filteredSections =
    selected === null
      ? []
      : sections.map((section) => ({
          ...section,
          bosses: filterByPartySize(section.bosses, selected.ocid, partyFilter),
        }))
  // (`countClearedWeeklyBosses`), 시즌 완료 여부도 등록과 무관하다.
  // `주간` 헤더가 싣는 배지. 이 값들은 **표시 목록과 무관하다.** 처치 수는 앱이 세고
  const weeklySeasonState =
    seasonBosses.length === 0 ? null : isSeasonBossComplete ? ('complete' as const) : ('incomplete' as const)
  const hasWeeklyBadges =
    weeklySeasonState !== null ||
    (selected?.weeklyBossClearCount != null && selected.weeklyBossClearLimitCount != null)

  // **단 배지를 싣고 있으면 남긴다.** 지우면 이번 주 처치 수를 화면이 말할 자리가 없어진다.
  // 빈 무리의 헤더는 걷는다. 이름만 남으면 **여기 뭔가 있었다** 로 읽힌다.
  const visibleSections = filteredSections.filter(
    (section) => section.bosses.length > 0 || (section.cycle === 'weekly' && hasWeeklyBadges),
  )
  const displayedCount = sections.reduce((sum, section) => sum + section.bosses.length, 0)
  const filteredCount = filteredSections.reduce((sum, section) => sum + section.bosses.length, 0)

  function renderBossCards(bosses: DisplayedBoss[], ocid: string): React.JSX.Element {
    const characterLevel = selected?.level ?? null

    return (
      <View className="gap-2">
        {bosses.map((boss) => (
          <BossCard
            key={`${boss.apiName}-${boss.difficulty}`}
            boss={boss}
            partySize={getPartySize(ocid, boss)}
            isBlocked={isBossBlocked(
              characterLevel,
              boss.matchedBossName ?? boss.apiName,
              boss.difficulty,
            )}
            onEdit={() => openPartyModal(boss)}
          />
        ))}
      </View>
    )
  }

  // 자동 모드에서는 카드가 그대로라 스토어만으로는 지금 무엇을 편집 중인지 알 수 없다.
  // 카드를 탭하면 열리는 파티 인원·난이도 모달. 편집 중인 난이도를 **모달이 따로 든다.**
  function openPartyModal(boss: MatchedBoss): void {
    setPartyModal({ boss, difficulty: boss.difficulty })
  }

  const modalBossName =
    partyModal !== null ? (partyModal.boss.matchedBossName ?? partyModal.boss.apiName) : null

  async function handleModalPartySize(next: number): Promise<void> {
    if (partyModal === null || selected === null || modalBossName === null) return
    try {
      await setPartySize(selected.ocid, modalBossName, partyModal.difficulty, next)
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했습니다')
    }
  }

  // 수동 모드에서만 멤버십이 바뀐다. 자동 모드는 편집 대상만 옮긴다. 카드의 난이도는 게임 등록
  // 수동 모드에서만 멤버십이 바뀐다. 자동 모드는 편집 대상만 옮긴다. 카드의 난이도는 게임 등록
  async function handleModalDifficulty(difficulty: BossDifficulty): Promise<void> {
    if (partyModal === null || selected === null || modalBossName === null) return
    setPartyModal({ ...partyModal, difficulty })
    if (mode !== 'manual') return
    try {
      await setManualBossDifficulty(selected.ocid, modalBossName, difficulty)
    } catch {
      useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
    }
  }

  // 이 화면은 피커를 열지 않는다. 빈 상태 CTA 가 **설정 탭을 피커가 열린 채로** 연다.
  function goToCharacterManage(): void {
    openTab('Settings', { openPicker: true })
  }

  //  이 만든 헤더 진입점("보스 관리")은 **여기 없다**.
  // 그 화면이 스케줄 그룹의 하위 탭이 되면서 진입 자리를 하단바가 가져갔다. 이 걷은
  // "캐릭터 관리"에 이어 제목 줄의 두 번째이자 마지막 버튼이 사라진 것이라, 이제 그 줄에서 폭을
  // 다투는 상대가 없다.
  //
  // 남는 것은 빈 상태 CTA 하나이고, 그것도 push 가 아니라 **같은 층의 형제**로 보낸다
  // (보스 관리는 이 화면과 같은 스케줄러 단에 산다).
  function goToBossManage(): void {
    openTab('BossManage')
  }

  // 빈 상태 문구는 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다. 자동 모드가
  // 지시하는 곳("게임에서 등록")은 앱 밖이라 데려다줄 수 없다.
  //
  // **주기별로 나누던 축은 사라졌다**(정정). 목록이 하나라
  // 판정도 하나이고, 무리별로 물으면 검마를 안 잡는 캐릭터마다 **추적할 월간 보스가 없습니다** 가
  // 뜬다. 그것은 빈 상태가 아니라 **그냥 그 캐릭터의 목록**이다.
  function bossEmptyProps(): React.ComponentProps<typeof EmptyState> {
    if (mode === 'manual') {
      return {
        icon: SwordsIcon,
        title: '추적할 보스가 없습니다',
        description: '보스 관리에서 이번에 잡을 보스를 골라주세요',
        action: { label: '보스 관리', onClick: goToBossManage },
      }
    }
    return {
      icon: SwordsIcon,
      title: '등록된 보스가 없습니다',
      description: '게임 내 스케줄러에 등록하면 여기에 자동으로 표시됩니다',
    }
  }

  // 필터가 가린 상태라 CTA 는 필터를 되돌린다.
  function filterEmptyProps(): React.ComponentProps<typeof EmptyState> {
    return {
      icon: SlidersHorizontalIcon,
      title: '이 조건에 해당하는 보스가 없습니다',
      description: '솔로·파티 필터를 해제하면 전체 보스를 볼 수 있습니다',
      action: { label: '필터 초기화', onClick: () => setPartyFilter('all') },
    }
  }

  if (isEmpty) {
    // 헤더 셸을 안 쓰는 가지라 상단 안전영역을 여기서 먹는다. 높이는 `flex-1` 이다.
    return (
      <View testID="screen-Boss" className="flex-1 p-4" style={{ paddingTop: topSafeAreaPx }}>
        {/* 헤더 셸을 안 쓰는 가지에서도 제목 줄은 같은 프리미티브다. 빈 상태와 목록 상태를
            오갈 때 제목이 튀면 가장 눈에 띈다. */}
        <PageHeaderTitleRow>
          <Text className="text-lg font-semibold text-text">보스 스케줄러</Text>
        </PageHeaderTitleRow>

        <View className="flex-1 items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="표시할 캐릭터가 없습니다"
            description="캐릭터를 선택하면 주간·월간 보스 스케줄을 확인할 수 있습니다"
            action={{ label: '캐릭터 선택하기', onClick: goToCharacterManage }}
          />
        </View>
      </View>
    )
  }

  return (
    <View testID="screen-Boss" className="flex-1">
      <ScreenScroll
        // 당김은 헤더 버튼과 **같은 재조회**를 부른다. 컨텐츠 스케줄러와 배선이 같아야 한다.
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={definition.primaryInk}
            colors={[definition.primaryInk]}
            progressBackgroundColor={definition.surface}
          />
        }
        header={
          // `fixed` 도 spacer 도 없다.
          // 제목과 필터도 목록과 **함께 스크롤된다.** 헤더가 `ScreenScroll` 의 첫 자식이라
          <PageHeader>
            {/* 폭을 다투면 시각 텍스트만 줄어든다(제목·새로고침은 `shrink-0`). 줄에 가를
                상대가 없어 `justify-between` 은 두지 않는다. */}
            <PageHeaderTitleRow className="gap-2">
              <Text className="shrink-0 text-lg font-semibold text-text">보스 스케줄러</Text>
              <Text className="shrink text-sm text-text-muted" numberOfLines={1}>
                {status === 'loading' ? '조회 중...' : selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
              </Text>
              <Pressable
                role="button"
                aria-label="새로고침"
                onPress={() => refresh(trackedOcids ?? [])}
                className="shrink-0 p-2"
              >
                <AnimatedView
                  testID="refresh-icon"
                  style={status === 'loading' && !reduceMotion ? SPIN_ANIMATION : undefined}
                >
                  <RefreshCwIcon className="h-4 w-4 text-primary-ink" strokeWidth={2} aria-hidden />
                </AnimatedView>
              </Pressable>
            </PageHeaderTitleRow>

            {/* 조건이 **줄 밖**에 있다. 안에 두면 캐릭터가 없는 동안 빈 줄이 `gap-4` 를 두 번
                먹는다. */}
            {characters.length > 0 && selected !== null && (
              <CharacterRail
                entries={railEntries}
                selectedOcid={selected.ocid}
                onSelect={(ocid) => {
                  void select(ocid)
                }}
              />
            )}

            {/* 캐시된 `characters` 가 있으면 재검증 중에도 계속 보여준다. 셸 승계 카드는
                보여줄 데이터가 아예 없을 때만 그린다. */}
            {(status === 'idle' || status === 'loading') && characters.length === 0 && (
              <LoadingState size="page" message="불러오고 있어요" />
            )}

            {/* `n/12`·`season` 배지는 `주간` 섹션 헤더가 싣는다. 그 수치가 어느 무리의
                것인지 헤더가 말한다. 이 줄에 남는 것은 필터 하나뿐이다. */}
            {characters.length > 0 && selected !== null && (
              <View className="flex-row items-center gap-2">
                {(['all', 'solo', 'party'] as const).map((filter) => (
                  <Pressable
                    key={filter}
                    role="button"
                    aria-selected={partyFilter === filter}
                    onPress={() => setPartyFilter(filter)}
                  >
                    <Text
                      className={
                        partyFilter === filter
                          ? 'rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary-ink'
                          : 'px-3 text-xs font-medium text-text-muted'
                      }
                    >
                      {PARTY_FILTER_LABELS[filter]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </PageHeader>
        }
      >
        {characters.length > 0 && selected !== null && (
          <View testID="pull-content" className="gap-4 px-4 pb-4">
            {/* 빈 상태 둘은 **목록 하나**를 보고 판정한다. 무리별로 물으면 검마를 안 잡는
                캐릭터마다 추적할 월간 보스가 없습니다 가 뜬다. */}
            {displayedCount === 0 && (mode === 'manual' || !selected.isStale) && (
              <EmptyState {...bossEmptyProps()} />
            )}

            {displayedCount > 0 && filteredCount === 0 && <EmptyState {...filterEmptyProps()} />}

            {/* 순서는 `displayedBossSections` 것이고 **비어 있는 무리는 이미 걷혔다**
                (`visibleSections`). 헤더만 남아 여기 뭔가 있었다로 읽히지 않게 한다. */}
            {visibleSections.map((section) => (
              <View key={section.cycle} className="gap-2">
                <View
                  testID={`boss-section-header-${section.cycle}`}
                  className="flex-row items-center justify-between gap-2"
                >
                  <Text className="text-sm font-semibold text-text">
                    {section.cycle === 'weekly' ? '주간' : '월간'}
                  </Text>
                  {section.cycle === 'weekly' && (
                    <View className="flex-row items-center gap-2">
                      {weeklySeasonState !== null && (
                        <Badge variant={weeklySeasonState === 'complete' ? 'secondary' : 'primary'}>
                          {`season ${weeklySeasonState === 'complete' ? '완료' : '미완료'}`}
                        </Badge>
                      )}
                      {selected.weeklyBossClearCount !== null &&
                        selected.weeklyBossClearLimitCount !== null && (
                          <Badge variant="primary">
                            {selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}
                          </Badge>
                        )}
                    </View>
                  )}
                </View>
                {section.bosses.length > 0 && renderBossCards(section.bosses, selected.ocid)}
              </View>
            ))}
          </View>
        )}
      </ScreenScroll>

      {partyModal !== null && selected !== null && modalBossName !== null && (
        <PartySizeModal
          bossName={modalBossName}
          cycleLabel={partyModal.boss.cycle === 'monthly' ? '월간 보스' : '주간 보스'}
          portraitSlug={partyModal.boss.portraitSlug}
          // 참조표에 없는 보스는 후보를 알 수 없다. 지금 난이도 하나만 그려 세그먼트가 사라지지 않게 한다.
          difficulties={
            getSupportedDifficulties(modalBossName).length > 0
              ? getSupportedDifficulties(modalBossName)
              : [partyModal.difficulty]
          }
          difficulty={partyModal.difficulty}
          partySize={partySizes[partySizeKey(selected.ocid, modalBossName, partyModal.difficulty)] ?? 1}
          maxPartySize={getMaxPartySize(modalBossName, partyModal.difficulty)}
          onSelectDifficulty={(difficulty) => void handleModalDifficulty(difficulty)}
          onChangePartySize={(next) => void handleModalPartySize(next)}
          onClose={() => setPartyModal(null)}
        />
      )}
    </View>
  )
}
