/**
 * 보스 관리 화면. 추적 편집(수동)과 파티 인원 설정을 하는 푸시 화면.
 *
 * 행의 원형 `BossPortrait` 에는 프롭을 그대로 넘기기만 하고 계산을 갖지 않는다.
 */
import { useMemo, useState } from 'react'
import { autoFeeFrom, useMvpGradeContext } from '../../features/mvp-grade/store'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { Pressable, View } from 'react-native'

import { partySizeKey, useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useBossSchedule } from '../../features/boss-scheduler/use-boss-schedule'
import { BOSS_SECTION_ORDER } from '../../features/boss-scheduler/displayed-bosses'
import { resolveSelectedCharacter } from '../../features/character-selection/selected-character'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import { useToastStore } from '../../features/toast/store'
import { useGameTable } from '../../features/game-data/sync'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { partySizeForShares } from '../../lib/boss/party-shares'
import type { BossPartyShareColumns } from '../../storage/boss-party-settings'
import { PartySizeModal } from '../../components/organisms/PartySizeModal/PartySizeModal'
import { activeBossesInSection, activeDifficultiesNow, bossPortraitSlugOf, getMaxPartySize } from '../../lib/boss/bosses'
import { countManualWeeklyBosses, WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/boss-matching'
import { bossCycleOf, isSeasonBoss, type BossEntry } from '../../lib/boss/bosses'
import { isChallengersWorld } from '../../lib/world/worlds'
import { useRealtimeFetchedAt } from '../../features/refresh/freshness'
import { orderByTracked } from '../../lib/scheduler/tracked-order'
import type { BossDifficulty } from '../../types'

import { Badge, CheckIcon, Switch, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { CharacterRail, type CharacterRailEntry } from '../../components/organisms/CharacterRail/CharacterRail'
import { CharacterUnavailableNotice } from '../../components/organisms/CharacterUnavailable/CharacterUnavailableNotice'
import { DifficultyExpander } from '../../components/molecules/DifficultyExpander/DifficultyExpander'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { useOpenTab } from '../../hooks/useOpenTab'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { PartyShareSummary } from '../../components/molecules/PartyShareSummary/PartyShareSummary'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'


/** 주인이 다른 편집 표를 읽을 때 대신 주는 빈 표. 렌더마다 새 객체를 만들지 않는다. */
const NO_DIFFICULTY_EDITS: Record<string, BossDifficulty> = {}

// 수동 모드는 행 탭이 추적 토글이고 즉시 저장한다. 추적 중인 행에만 난이도 고르개와 파티 요약이 선다.
// 자동 모드는 추적 없이 파티만 설정하고, 미등록 보스도 미리 설정할 수 있다.
// 초상 옆에 보스명과, 그 아래 고르개 · 파티 요약 한 줄을 쌓는다.
/** 비율을 안 쓰는 파티. 설정이 없는 조합이 이 값을 그린다. */
const NO_SHARES: BossPartyShareColumns = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
}

export function BossManageScreen(): React.JSX.Element {
  // 스케줄은 캐시에서, 기기 값(파티 인원 · 수동 추적)은 스토어에서 온다. 스케줄러를 거치지 않고 직접 진입해도 훅이 받는다.
  const { status, characters: storeCharacters, trackedOcids } = useBossSchedule()
  const {
    partySizes,
    partyShares,
    manualTrackedByOcid,
    setPartySetting,
    addManualBoss,
    removeManualBoss,
    setManualBossDifficulty,
    // 선택 캐릭터는 스케줄러와 공유한다. 두 화면이 갈라지면 안 된다.
  } = useBossSchedulerStore()
  const gradeContext = useMvpGradeContext()
  // 선택한 캐릭터는 앱 전체가 한 벌로 든다.
  const { selectedOcid, select } = useCharacterSelectionStore()
  const { mode } = useTrackingModeStore()
  // 방향이 뒤집혀 읽힌다.
  // 스위치는 `모든 보스 보기`(기본 꺼짐)다. `거른다` 를 뜻하는 스위치는 끄면 더 보인다가 되어
  const [showAllBosses, setShowAllBosses] = useState(false)
  // 행의 `변경` 으로 여는 파티 모달. 인원과 비율을 함께 고친다.
  const [partyModal, setPartyModal] = useState<{ entry: BossEntry; difficulty: BossDifficulty } | null>(null)
  /**
   * 자동 모드에서 행마다 어느 난이도의 파티 인원을 편집 중인지. 멤버십이 아니라 저장하지 않는다.
   *
   * `ocid` 가 이 표의 주인이다. 보스 key 만으로 키를 잡으면 캐릭터를 옮겼을 때 같은 보스의 행에
   * 앞 캐릭터의 선택이 그대로 남는다.
   */
  const [difficultyEdit, setDifficultyEdit] = useState<{
    ocid: string | null
    byBoss: Record<string, BossDifficulty>
  }>({ ocid: null, byBoss: {} })

  // 스토어가 내는 것은 기준 순서(레벨 내림차순)이고 화면 순서는 캐릭터 관리에서 정한 배열이다.
  // 스케줄러 화면과 같은 함수를 통과시켜야 두 화면의 레일이 같은 차례로 선다.
  const characters = orderByTracked(storeCharacters, trackedOcids ?? [])

  // 스케줄러와 같은 실시간 원천을 그린다. 값도 같아야 한다.
  const fetchedAt = useRealtimeFetchedAt()

  // 화면 넷이 **같은 규칙**으로 고른다. 폴백을 화면마다 두면 공유했는데 화면마다 다른 캐릭터가 된다.
  // 넘기는 목록이 화면 순서여야 한다. 폴백이 그 첫 번째다.
  const selected = resolveSelectedCharacter(selectedOcid, characters)
  // 조회 불가 안내가 캐릭터 관리로 보내는 길. 빈 상태 CTA 와 같은 목적지다.
  const openTab = useOpenTab()
  const navigation = useScreenNavigation()

  /**
   * 지금 캐릭터의 편집 표. 주인이 다르면 빈 표다.
   *
   * 캐릭터를 옮기는 것이 편집을 끝내는 행위다. 안 버리면 앞 캐릭터가 고른 난이도가 보스 key 만으로
   * 이 캐릭터의 행에 남고, 그 난이도가 스테퍼로 흘러가 잡지도 않는 난이도의 파티 인원이 저장된다.
   */
  const autoDifficultyByBoss =
    difficultyEdit.ocid === (selected?.ocid ?? null) ? difficultyEdit.byBoss : NO_DIFFICULTY_EDITS

  // 링 없는 초상화 레일. 이름과 레벨만 싣는다(`rings: []`).
  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    // 동기화가 이 캐릭터를 조회하지 못했다. 링의 진행도는 마지막으로 본 값이라 지우지 않고
    // 표식만 얹는다.
    unavailable: character.error?.kind === 'characterUnavailable',
    rings: [],
  }))

  // 등록 난이도 조회(보스 key → 난이도). 난이도 기본 선택(등록 난이도 우선)과 자동 모드의 "등록된 보스만
  // 보기"에 쓴다. 보스 표에 없는 보스는 이 목록에 행이 없어 넣지 않는다.
  const registeredDifficultyByBoss = new Map<string, BossDifficulty>()
  if (selected !== null) {
    for (const boss of [...selected.weeklyBosses, ...selected.monthlyBosses]) {
      if (boss.isRegistered && boss.bossKey !== null) {
        registeredDifficultyByBoss.set(boss.bossKey, boss.difficulty)
      }
    }
  }

  const trackedBossItems =
    selected !== null
      ? (manualTrackedByOcid?.[selected.ocid] ?? []).filter((item) => item.kind === 'boss')
      : []

  function trackedDifficultyOf(bossKey: string): BossDifficulty | null {
    return trackedBossItems.find((candidate) => candidate.bossKey === bossKey)?.difficulty ?? null
  }

  function defaultDifficultyFor(bossKey: string, difficulties: BossDifficulty[]): BossDifficulty | null {
    return registeredDifficultyByBoss.get(bossKey) ?? difficulties[0] ?? null
  }

  // 12는 주간 한도이고 시즌 보스는 예외다. 카운트 규칙은 `lib/boss/boss-matching` 한 곳에만 있다.
  const weeklyTrackedCount = countManualWeeklyBosses(trackedBossItems)
  const isWeeklyLimitReached = mode === 'manual' && weeklyTrackedCount >= WEEKLY_BOSS_CLEAR_LIMIT

  function countsTowardWeeklyLimit(bossKey: string): boolean {
    return bossCycleOf(bossKey) === 'weekly' && !isSeasonBoss(bossKey)
  }

  // 비-챌린저스로 본다. 판정은 스케줄러 화면과 같은 함수여야 한다.
  // 시즌 보스는 챌린저스 월드 전용이라 그 월드 캐릭터에게만 보인다. 월드를 모르는 구버전 캐시는
  const showsSeasonBosses = isChallengersWorld(selected?.worldKey)
  // 목록은 보스 표에서 지금 기간에 유효한 것이다. 시즌이 끝난 시즌 보스는 빠진다. 주간 탭은 주간(챌린저스
  // 월드는 시즌 주간까지), 월간 탭은 월간이다. 난이도
  // 후보도 같은 표의 `difficulties` 를 쓴다. 표는 켜는 동안 서버 응답으로 덮일 수 있어 칸을 구독하고,
  // 덮이면 목록을 다시 만든다.
  const catalog = useGameTable('bosses')
  const listed = useMemo<Record<'weekly' | 'eventWeekly' | 'monthly', BossEntry[]>>(
    () => ({
      weekly: activeBossesInSection('weekly'),
      eventWeekly: activeBossesInSection('eventWeekly'),
      monthly: activeBossesInSection('monthly'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 표가 바뀌었다는 신호다. 값은 `bossesInSection` 이 같은 표에서 읽는다.
    [catalog],
  )
  // **무리 둘이고 월간이 위다.** 스케줄러 목록과 같은 순서여야 보는 화면과 편집 화면이 같아진다.
  const allSections = BOSS_SECTION_ORDER.map((cycle) => ({
    cycle,
    entries:
      cycle === 'monthly'
        ? listed.monthly
        : showsSeasonBosses
          ? [...listed.weekly, ...listed.eventWeekly]
          : listed.weekly,
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
        ? section.entries.filter((entry) => registeredDifficultyByBoss.has(entry.key))
        : section.entries,
    }))
    // 없으면 보여 줄 이유도 없다.
    // 무리가 비면 헤더도 안 선다. `주간` 헤더의 `n/12` 는 수동 모드에서 고른 개수라, 고를 행이
    .filter((section) => section.entries.length > 0)

  // 저장 실패를 토스트로 알린다. 안 알리면 체크가 조용히 되돌아가는 것 외에 설명이 없다.
  async function handleToggleTracked(bossKey: string, difficulties: BossDifficulty[]): Promise<void> {
    if (selected === null) return
    const trackedDifficulty = trackedDifficultyOf(bossKey)
    if (trackedDifficulty !== null) {
      try {
        await removeManualBoss(selected.ocid, bossKey, trackedDifficulty)
      } catch {
        useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
      }
      return
    }
    const difficulty = defaultDifficultyFor(bossKey, difficulties)
    if (difficulty === null) return
    // 안내이고, `error` 는 자동 소멸이 없어 사용자가 직접 닫아야 한다.
    // 한도 초과는 행을 막지 않고 눌렀을 때 토스트로 알린다. `showInfo` 다. 실패가 아니라 규칙
    try {
      const result = await addManualBoss(selected.ocid, bossKey, difficulty)
      if (result === 'limitReached') {
        useToastStore.getState().showInfo(`주간 ${WEEKLY_BOSS_CLEAR_LIMIT}개를 모두 선택했어요`)
      }
    } catch {
      useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
    }
  }

  // remove → add 2단계는 커밋이 2회라 그 사이에 보스가 목록에 없는 상태가 실재했다.
  // 수동 모드의 난이도 변경은 멤버십 교체다. 스토어의 단일 액션이 쓰기 1회로 끝낸다.
  async function handleSwitchDifficulty(bossKey: string, to: BossDifficulty): Promise<void> {
    if (selected === null) return
    try {
      await setManualBossDifficulty(selected.ocid, bossKey, to)
    } catch {
      useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
    }
  }

  const modalKey =
    partyModal === null ? null : partySizeKey(selected?.ocid ?? '', partyModal.entry.key, partyModal.difficulty)
  // 모달이 뜰 때의 값. 고치는 중인 값은 모달이 들고 있다가 적용할 때 한 번에 돌려준다.
  const modalShares = modalKey === null ? NO_SHARES : partyShares[modalKey] ?? NO_SHARES

  async function handleSetParty(
    bossKey: string,
    difficulty: BossDifficulty,
    input: { partySize: number; shares: BossPartyShareColumns },
  ): Promise<void> {
    if (selected === null) return
    try {
      await setPartySetting(selected.ocid, bossKey, difficulty, input)
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했습니다')
    }
  }

  /** 적용을 누른 자리. 여기서 처음 쓴다. 끌기 한 번이 저장 아홉 번이 되지 않는 까닭이다. */
  async function applyParty(next: { partySize: number; shares: BossPartyShareColumns }): Promise<void> {
    const target = partyModal
    setPartyModal(null)
    if (target === null) return
    await handleSetParty(target.entry.key, target.difficulty, {
      // 비율을 쓰면 두 쪽이라 2 다. 배지·필터가 그 수를 본다.
      partySize: partySizeForShares(
        {
          myShare: next.shares.crystalMyShare,
          sharesTotal: next.shares.crystalSharesTotal,
          splitFeePercent: null,
        },
        next.partySize,
      ),
      shares: next.shares,
    })
  }

  // 인원과 비율을 적고 모달로 보내는 줄. 스테퍼는 수 하나만 올리고 내릴 수 있어 비율이 들어갈
  // 자리가 없다.
  function renderPartySummary(entry: BossEntry, difficulty: BossDifficulty): React.JSX.Element {
    const ocid = selected?.ocid ?? ''
    const key = partySizeKey(ocid, entry.key, difficulty)
    const columns = partyShares[key] ?? NO_SHARES
    return (
      <PartyShareSummary
        label={entry.name}
        partySize={partySizes[key] ?? 1}
        crystal={{
          myShare: columns.crystalMyShare,
          sharesTotal: columns.crystalSharesTotal,
          splitFeePercent: columns.splitFeePercent,
        }}
        side="end"
        onPress={() => setPartyModal({ entry, difficulty })}
      />
    )
  }

  return (
    <ScreenScroll
      // 설정에서 여는 하위 페이지라 하단바가 없다.
      hasTabBar={false}
      header={
        // 헤더는 제목 줄 하나다. 레일도 토글도 콘텐츠로 내려갔다. 헤더에 담는 것은 ← · 제목 · 기준 시각이다.
        <PageHeader>
          <PageHeaderTitleRow fetchedAt={fetchedAt} className="gap-2">
            <BackButton onPress={() => navigation.goBack()} />
            <Text className="text-lg font-bold text-text">보스 관리</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      {/* 캐릭터를 고르는 장치라 콘텐츠다. **여기에는 진행 링이 없다**(`rings: []`) - 이 화면의
          일은 캐릭터를 고르는 것이지 진행을 보는 것이 아니다.

          좌우 여백을 주지 않는다. 레일이 자기 안쪽 스크롤로 그 16 을 든다. */}
      {selected !== null && (
        <CharacterRail
          entries={railEntries}
          selectedOcid={selected.ocid}
          onSelect={(ocid) => {
            void select(ocid)
          }}
        />
      )}

      {/* 목록에서 무엇을 보는가를 고르는 장치라 콘텐츠다. 끄면 무엇이 걸러지는지 설명을 함께 적는다.

          글자가 스위치 안이라 줄의 글자를 눌러도 토글된다. 스위치만 표적이면 44x24 하나뿐이다.
          `n/12` 카운터는 `주간` 섹션 헤더가 싣는다. */}
      {selected !== null && mode === 'auto' && (
        <View className="px-4">
          <Switch
            on={showAllBosses}
            label="모든 보스 보기"
            onToggle={() => {
              setShowAllBosses((prev) => !prev)
            }}
            className="justify-between gap-3 rounded-[14px] bg-surface px-3.5 py-3"
          >
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-sm font-semibold text-text">모든 보스 보기</Text>
              <Text className="text-xs text-text-muted">끄면 스케줄러에 등록한 보스만 보여요</Text>
            </View>
          </Switch>
        </View>
      )}

      <View testID="screen-BossManage">
        {/* 조회가 끝나기 전(idle·loading)에는 빈 상태 문구로 위장하지 않는다. */}
        {selected === null && (status === 'idle' || status === 'loading') ? (
          <View className="px-4 pb-4">
            <LoadingState size="page" message="불러오고 있어요" />
          </View>
        ) : selected === null ? (
          <View className="px-4 pb-4">
            <Text className="text-sm text-text-muted">
              캐릭터를 먼저 선택해주세요. 설정의 ‘캐릭터 관리’에서 추가할 수 있어요.
            </Text>
          </View>
        ) : selected.error?.kind === 'characterUnavailable' ? (
          // 편집할 목록이 **빈 것이 아니라 모르는 것**이다. 체크박스를 세우면 사용자가 지금
          // 추적을 고르고 있다고 믿는데, 그 선택은 조회가 돌아와야 뜻을 갖는다.
          <View className="px-4 pb-4 pt-8">
            <CharacterUnavailableNotice
              onOpenCharacterManage={() => openTab('Settings', { openPicker: true })}
            />
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
                  <Text className="text-sm font-normal text-text">
                    {section.cycle === 'weekly' ? '주간' : '월간'}
                  </Text>
                  {mode === 'manual' && section.cycle === 'weekly' && (
                    <Badge variant="primary">
                      {weeklyTrackedCount}/{WEEKLY_BOSS_CLEAR_LIMIT}
                    </Badge>
                  )}
                </View>
                {section.entries.map((entry) => {
              const trackedDifficulty = mode === 'manual' ? trackedDifficultyOf(entry.key) : null
              const isTracked = trackedDifficulty !== null

              // 한도가 찼을 때 미선택 행은 흐리게만 둔다. 비활성화하면 이유를 알릴 수 없다.
              const isLimitBlocked =
                mode === 'manual' &&
                !isTracked &&
                isWeeklyLimitReached &&
                countsTowardWeeklyLimit(entry.key)

              // 자동 모드의 행 난이도: 화면 전용 선택 → 등록 난이도 → 첫 난이도 순.
              // 지금 기간에 유효한 난이도만. 시작 전인 난이도와 끝난 난이도는 안 선다.
              const difficulties = activeDifficultiesNow(entry.key)
              const autoDifficulty =
                autoDifficultyByBoss[entry.key] ?? defaultDifficultyFor(entry.key, difficulties)

              // 고르개 · 파티 요약이 서는 난이도: 수동은 추적 난이도, 자동은 행 난이도.
              const activeDifficulty = mode === 'manual' ? trackedDifficulty : autoDifficulty

              return (
                <View key={entry.key} testID={`boss-manage-row-${entry.key}`} className="rounded-[14px] bg-surface">
                  {/* 수동 모드는 카드 전체가 추적 토글이다. 내용 뒤에 깔고, 내용은 고르개 · 파티 요약 밖의 누름을
                      이 토글로 흘려보낸다. 고르개를 토글 안에 넣으면 스크린리더가 둘을 한 덩어리로 읽는다. */}
                  {mode === 'manual' && (
                    <Pressable
                      role="button"
                      aria-selected={isTracked}
                      aria-label={entry.name}
                      onPress={() => void handleToggleTracked(entry.key, difficulties)}
                      className="absolute inset-0 rounded-[14px]"
                    />
                  )}

                  {/* 흐림은 카드가 아니라 안쪽 내용에만 건다. 카드에 걸면 위에 얹는 안내까지 함께 흐려진다. */}
                  <View
                    pointerEvents="box-none"
                    className={`flex-row items-center gap-3 px-3.5 py-4${isLimitBlocked ? ' opacity-40' : ''}`}
                  >
                    <View aria-hidden pointerEvents="none">
                      <BossPortrait portraitSlug={entry.portraitSlug} label={entry.name} size={44} />
                      {isTracked && <TrackedMark />}
                    </View>
                    {activeDifficulty !== null ? (
                      <View pointerEvents="box-none" className="min-w-0 flex-1 gap-2.5">
                        <View pointerEvents="none">
                          <Text numberOfLines={1} className="text-sm font-semibold text-text">
                            {entry.name}
                          </Text>
                        </View>
                        <View pointerEvents="box-none" className="flex-row items-center justify-between gap-2">
                          <DifficultyExpander
                            label={entry.name}
                            difficulties={difficulties}
                            value={activeDifficulty}
                            onChange={(difficulty) =>
                              mode === 'manual'
                                ? void handleSwitchDifficulty(entry.key, difficulty)
                                : setDifficultyEdit({
                                    ocid: selected?.ocid ?? null,
                                    byBoss: { ...autoDifficultyByBoss, [entry.key]: difficulty },
                                  })
                            }
                          />
                          {renderPartySummary(entry, activeDifficulty)}
                        </View>
                      </View>
                    ) : (
                      <View pointerEvents="none" className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-sm text-text-muted">
                          {entry.name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )
                })}
              </View>
            ))}
          </View>
        )}
      </View>

      {partyModal !== null && selected !== null && (
        <PartySizeModal
          bossName={partyModal.entry.name}
          cycleLabel={bossCycleOf(partyModal.entry.key) === 'monthly' ? '월간 보스' : '주간 보스'}
          portraitSlug={bossPortraitSlugOf(partyModal.entry.key)}
          difficulties={activeDifficultiesNow(partyModal.entry.key)}
          difficulty={partyModal.difficulty}
          partySize={partySizes[partySizeKey(selected.ocid, partyModal.entry.key, partyModal.difficulty)] ?? 1}
          maxPartySize={getMaxPartySize(partyModal.entry.key, partyModal.difficulty)}
          shares={modalShares}
          // 설정은 앞으로 적힐 기록의 약속이라 이번 주 등급을 보인다.
          autoFee={gradeContext === null ? null : autoFeeFrom(gradeContext, selected.ocid, getCurrentKstDateKey(new Date()))}
          // 난이도는 행의 고르개가 정한다. 그래서 모달은 난이도를 배지로만 보인다.
          onApply={(next) => void applyParty(next)}
          // 적용을 안 눌렀으면 고친 값은 버린다.
          onClose={() => setPartyModal(null)}
        />
      )}
    </ScreenScroll>
  )
}

/**
 * 추적 중인 보스의 초상 표시. 초상을 primary 링으로 두르고 오른쪽 아래에 체크를 얹는다.
 *
 * 링은 초상에서 2 떨어진다. 붙이면 초상 그림의 가장자리와 섞여 링으로 안 읽힌다.
 */
function TrackedMark(): React.JSX.Element {
  return (
    <>
      <View testID="boss-tracked-mark" className="absolute -inset-1 rounded-full border-2 border-primary" />
      <View className="absolute -bottom-[5px] -right-[5px] h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-surface bg-primary">
        <CheckIcon className="h-[9px] w-[9px] text-on-primary" strokeWidth={3.5} />
      </View>
    </>
  )
}
