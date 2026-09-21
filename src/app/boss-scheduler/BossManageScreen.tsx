/**
 * 보스 관리 화면. 추적 편집(수동)과 파티 인원 설정을 하는 스케줄 그룹의 하위 탭.
 *
 * 행의 원형 `BossPortrait` 에는 프롭을 그대로 넘기기만 하고 계산을 갖지 않는다.
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { partySizeKey, useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { BOSS_SECTION_ORDER } from '../../features/boss-scheduler/displayed-bosses'
import { resolveSelectedCharacter } from '../../features/character-selection/selected-character'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import { useToastStore } from '../../features/toast/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { getMaxPartySize } from '../../lib/boss/boss-crystal-prices'
import { partySizeForShares } from '../../lib/boss/party-shares'
import type { BossPartyShareColumns } from '../../storage/boss-party-settings'
import { PartySizeModal } from '../../components/organisms/PartySizeModal/PartySizeModal'
import { bossPortraitSlugOf, supportedDifficultiesOf } from '../../lib/boss/bosses'
import { countManualWeeklyBosses, WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/boss-matching'
import { bossCycleOf, bossesInSection, isSeasonBoss, type BossEntry } from '../../lib/boss/bosses'
import { isChallengersWorld } from '../../lib/world/worlds'
import { useDataFreshness } from '../../features/refresh/freshness'
import { orderByTracked } from '../../lib/scheduler/tracked-order'
import type { BossDifficulty } from '../../types'

import { Badge, Switch, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { CharacterRail, type CharacterRailEntry } from '../../components/organisms/CharacterRail/CharacterRail'
import { CharacterUnavailableNotice } from '../../components/organisms/CharacterUnavailable/CharacterUnavailableNotice'
import { DifficultySegment } from '../../components/molecules/DifficultySegment/DifficultySegment'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { useOpenTab } from '../../hooks/useOpenTab'
import { PartyShareSummary } from '../../components/molecules/PartyShareSummary/PartyShareSummary'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'


/** 주인이 다른 편집 표를 읽을 때 대신 주는 빈 표. 렌더마다 새 객체를 만들지 않는다. */
const NO_DIFFICULTY_EDITS: Record<string, BossDifficulty> = {}

// 목록은 보스 표(`weekly-bosses.json`) 그대로다. 주간 탭은 주간(챌린저스 월드는 시즌 주간까지),
// 월간 탭은 월간이다. 난이도 후보도 같은 표의 `difficulties` 를 쓴다.
// 미출시 보스(`status: 'unreleased'`)는 뺀다. 보스를 코드에 안 박고 데이터로 거르므로 출시되면 그 칸을
// 지우는 것만으로 돌아온다. 지금 걸리는 줄은 0개다.
function listedBosses(section: 'weekly' | 'eventWeekly' | 'monthly'): BossEntry[] {
  return bossesInSection(section).filter((entry) => entry.status !== 'unreleased')
}

const WEEKLY_BOSSES: BossEntry[] = listedBosses('weekly')
const SEASON_BOSSES: BossEntry[] = listedBosses('eventWeekly')
const MONTHLY_BOSSES: BossEntry[] = listedBosses('monthly')

// 수동 모드는 행 탭이 추적 토글이고 즉시 저장한다. 체크된 행에만 난이도와 스테퍼가 펼쳐진다.
// 자동 모드는 체크 없이 파티 인원만 설정하고, 미등록 보스도 미리 설정할 수 있다.
// 행은 두 줄이다. 첫 줄이 초상 + 보스명 + 파티 스테퍼, 둘째 줄이 난이도 세그먼트다.
/** 비율을 안 쓰는 파티. 설정이 없는 조합이 이 값을 그린다. */
const NO_SHARES: BossPartyShareColumns = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  dropMyShare: null,
  dropSharesTotal: null,
  splitFeePercent: null,
}

export function BossManageScreen(): React.JSX.Element {
  const {
    status,
    characters: storeCharacters,
    trackedOcids,
    partySizes,
    partyShares,
    manualTrackedByOcid,
    loadTrackedOcids,
    setPartySetting,
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

  // 스케줄러를 거치지 않고 직접 진입해도 스토어가 채워지도록 동일하게 로드한다.
  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 스토어가 내는 것은 기준 순서(레벨 내림차순)이고 화면 순서는 캐릭터 관리에서 정한 배열이다.
  // 스케줄러 화면과 같은 함수를 통과시켜야 두 화면의 레일이 같은 차례로 선다.
  const characters = orderByTracked(storeCharacters, trackedOcids ?? [])

  // 스케줄러와 같은 실시간 원천을 그린다. 값도 같아야 한다.
  const fetchedAt = useDataFreshness((state) => state.fetchedAt)

  // 화면 넷이 **같은 규칙**으로 고른다. 폴백을 화면마다 두면 공유했는데 화면마다 다른 캐릭터가 된다.
  // 넘기는 목록이 화면 순서여야 한다. 폴백이 그 첫 번째다.
  const selected = resolveSelectedCharacter(selectedOcid, characters)
  // 조회 불가 안내가 캐릭터 관리로 보내는 길. 빈 상태 CTA 와 같은 목적지다.
  const openTab = useOpenTab()

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
        drop={{
          myShare: columns.dropMyShare,
          sharesTotal: columns.dropSharesTotal,
          splitFeePercent: columns.splitFeePercent,
        }}
        onPress={() => setPartyModal({ entry, difficulty })}
      />
    )
  }

  return (
    <ScreenScroll
      header={
        // 헤더는 제목 줄 하나다. 레일도 토글도 콘텐츠로 내려갔다. 헤더에 담는 것은 제목 ·
        // 기준 시각 · 다른 페이지로 가는 것 셋뿐이다.
        <PageHeader>
          {/* **← 가 없다.** 하위 페이지가 아니라 스케줄 그룹의 하위 탭이라 pop 할 스택이 없고,
              뒤로 가는 일은 하단바가 진다. */}
          <PageHeaderTitleRow fetchedAt={fetchedAt}>
            <Text className="text-lg font-semibold text-text">보스 관리</Text>
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

      {/* 목록에서 무엇을 보는가를 고르는 장치라 콘텐츠다.

          글자가 스위치 안이라 글자를 눌러도 토글된다. 스위치만 표적이면 44x24 하나뿐이다.
          `자동 모드 안내 문구`는 두지 않는다. 화면이 이미 그것을 보여 준다(체크가 없고 스테퍼만
          있다). `n/12` 카운터는 `주간` 섹션 헤더가 싣는다. */}
      {selected !== null && mode === 'auto' && (
        <View className="items-end px-4">
          <Switch
            on={showAllBosses}
            label="모든 보스 보기"
            size="lg"
            onToggle={() => {
              setShowAllBosses((prev) => !prev)
            }}
            className="gap-1.5"
          >
            <Text className="text-xs font-medium text-text-muted">모든 보스 보기</Text>
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
              캐릭터를 먼저 선택해주세요. 보스 스케줄러의 "캐릭터 관리"에서 추가할 수 있어요.
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
              const trackedDifficulty = mode === 'manual' ? trackedDifficultyOf(entry.key) : null
              const isTracked = trackedDifficulty !== null

              // 한도가 찼을 때 미선택 행은 흐리게만 둔다. 비활성화하면 이유를 알릴 수 없다.
              const isLimitBlocked =
                mode === 'manual' &&
                !isTracked &&
                isWeeklyLimitReached &&
                countsTowardWeeklyLimit(entry.key)

              // 자동 모드의 행 난이도: 화면 전용 선택 → 등록 난이도 → 첫 난이도 순.
              const autoDifficulty =
                autoDifficultyByBoss[entry.key] ?? defaultDifficultyFor(entry.key, entry.difficulties)

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
                    <BossPortrait portraitSlug={entry.portraitSlug ?? null} label={entry.name} size={44} />
                  </View>
                  <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-semibold text-text">
                    {entry.name}
                  </Text>
                </>
              )

              return (
                <View key={entry.key} className={rowClassName}>
                  {/* 1번째 줄: 초상화 + 보스명(수동은 추적 토글 버튼) + 파티 스테퍼(우상단) */}
                  <View className="flex-row items-center gap-3 px-3 py-2.5">
                    {mode === 'manual' ? (
                      <Pressable
                        role="button"
                        aria-selected={isTracked}
                        aria-label={entry.name}
                        onPress={() => void handleToggleTracked(entry.key, entry.difficulties)}
                        className="min-w-0 flex-1 flex-row items-center gap-3"
                      >
                        {nameContent}
                      </Pressable>
                    ) : (
                      <View className="min-w-0 flex-1 flex-row items-center gap-3">{nameContent}</View>
                    )}
                    {activeDifficulty !== null && renderPartySummary(entry, activeDifficulty)}
                  </View>

                  {/* 2번째 줄: 난이도 세그먼트 */}
                  {isExpanded && (
                    <View className="flex-row flex-wrap items-center gap-2 border-t border-border px-3 pb-2.5 pt-2.5">
                      {mode === 'manual' && trackedDifficulty !== null ? (
                        <DifficultySegment
                          difficulties={entry.difficulties}
                          selected={trackedDifficulty}
                          onSelect={(difficulty) => void handleSwitchDifficulty(entry.key, difficulty)}
                        />
                      ) : (
                        <DifficultySegment
                          difficulties={entry.difficulties}
                          selected={autoDifficulty}
                          onSelect={(difficulty) =>
                            setDifficultyEdit({
                              ocid: selected?.ocid ?? null,
                              byBoss: { ...autoDifficultyByBoss, [entry.key]: difficulty },
                            })
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

      {partyModal !== null && selected !== null && (
        <PartySizeModal
          bossName={partyModal.entry.name}
          cycleLabel={bossCycleOf(partyModal.entry.key) === 'monthly' ? '월간 보스' : '주간 보스'}
          portraitSlug={bossPortraitSlugOf(partyModal.entry.key)}
          difficulties={supportedDifficultiesOf(partyModal.entry.key)}
          difficulty={partyModal.difficulty}
          partySize={partySizes[partySizeKey(selected.ocid, partyModal.entry.key, partyModal.difficulty)] ?? 1}
          maxPartySize={getMaxPartySize(partyModal.entry.key, partyModal.difficulty)}
          shares={modalShares}
          // 이 화면의 난이도는 행의 세그먼트가 정한다. 모달에서 또 고치면 어느 쪽이 이기는지
          // 흐려진다.
          onSelectDifficulty={() => {}}
          onApply={(next) => void applyParty(next)}
          // 적용을 안 눌렀으면 고친 값은 버린다.
          onClose={() => setPartyModal(null)}
        />
      )}
    </ScreenScroll>
  )
}
