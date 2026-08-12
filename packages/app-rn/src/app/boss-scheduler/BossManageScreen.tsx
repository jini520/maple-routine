// 보스 관리 — 추적 편집(수동)과 파티 인원 설정([[ADR-035]] 결정 18).
//
// ══ RN 으로 옮기며 갈린 것 다섯 ═══════════════════════════════════════════════════
//
// ① **`StackScreen` 이 통째로 사라진다**([[ADR-120]]). 포털 오버레이·푸시/팝 전환·가장자리 스와이프·
//    탭바 밀어내기 넷이 전부 루트 스택의 성질이라, 셸은 `ScreenScroll(hasTabBar={false})` +
//    `PageHeader` 다(컨텐츠 관리·설정 하위 화면과 같은 골격).
// ② **`useStackBack(PARENT_PATH)` → `goBack()`**, 그래서 `PARENT_PATH` 상수도 사라진다 — 딥링크가
//    없어 *"돌아갈 곳이 없는 경우"* 가 존재하지 않는다(`app/use-screen-navigation.ts`).
// ③ `<button aria-pressed>` → `Pressable` + **`aria-selected`**(RN 접근성 상태에 *pressed* 가 없다).
// ④ **파티 스테퍼가 인라인 마크업에서 `PartySizeStepper`(molecule) 로 접힌다.** 3단계가 웹의 두
//    호출부(이 화면 · 파티 인원 모달)를 한 컴포넌트로 모아 두었으므로([[ADR-121]] 결정 7) 여기서는
//    `size="compact"` 로 부르기만 한다 — 웹에 남아 있던 복붙 한 벌이 그때 없어졌다.
// ⑤ **"등록된 보스만 보기" 토글이 손으로 그린 스위치 그대로다.** 웹의 `role="switch"` +
//    `aria-checked` 는 RN 에도 같은 역할이 있어 **갈리지 않고**(`CacheClearConfirm` 의 체크박스와
//    같은 판단), 노브 이동은 `translate-x-5` ↔ `translate-x-0` 두 클래스라 NativeWind 가 그대로
//    낸다. 웹의 `transition-*` 두 클래스만 빠진다 — RN 에 CSS 트랜지션이 없고, 이 자리에 Reanimated
//    를 새로 들이는 것은 옮기기가 아니라 새로 만들기다.
//
// ── 그림이 붙었다 ─────────────────────────────────────────────────────────────────
//
// 행의 원형 `BossPortrait` 이 3단계에서는 `?` 플레이스홀더만 그렸다(에셋과 크롭 기하 둘이 막고
// 있었다). [[ADR-129]] 가 에셋을, step 4·5 가 기하를 풀어 이제 진짜 초상이 나온다 — 이 화면은
// 프롭을 그대로 넘기기만 하고 계산을 갖지 않는다.
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import weeklyBossesData from '@core/data/weekly-bosses.json'
import { partySizeKey, useBossSchedulerStore, type BossTab } from '@core/features/boss-scheduler/store'
import { useToastStore } from '@core/features/toast/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { getMaxPartySize } from '@core/lib/boss-crystal-prices'
import {
  countManualWeeklyBosses,
  getBossCycleByName,
  isSeasonBossName,
  WEEKLY_BOSS_CLEAR_LIMIT,
} from '@core/lib/boss-matching'
import { isChallengersWorld } from '@core/lib/world-emblem'
import type { BossDifficulty } from '@core/types'

import { Badge } from '../../components/atoms/Badge/Badge'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { CharacterSelectDropdown } from '../../components/molecules/CharacterSelectDropdown/CharacterSelectDropdown'
import { DifficultySegment } from '../../components/molecules/DifficultySegment/DifficultySegment'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PartySizeStepper } from '../../components/molecules/PartySizeStepper/PartySizeStepper'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ArrowLeftIcon } from '../../lib/icons'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { useScreenNavigation } from '../use-screen-navigation'

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

// 관리 페이지의 보스 목록은 게임 레퍼런스 데이터(weekly-bosses.json) 그대로다 — 주간 탭은
// 주간(+챌린저스 월드에 한해 시즌 주간), 월간 탭은 월간([[ADR-035]] 결정 18, [[ADR-056]]). 난이도
// 후보도 같은 파일의 difficulties를 쓴다(폐기된 ManualBossPickerModal과 동일 소스).
// [[ADR-056]] 결정 1: 미출시 보스(status: 'unreleased', 현재 벨로나)는 목록에서 뺀다. 보스명을
// 코드에 박지 않고 데이터의 status로 거르므로, 출시되면 그 필드를 지우는 것만으로 되돌아온다.
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

// [[ADR-035]] 결정 18: 보스 관리 페이지 — 두 모드 공통 진입("보스 관리"), PartyManagementModal 대체.
// 수동 모드: 전체 보스 체크리스트(행 탭 = 추적 토글, 즉시 저장) + 체크된 행에만 난이도 뱃지와
// 파티 스테퍼가 펼쳐진다. 자동 모드: 체크 토글 없이 같은 행 구조로 파티 인원만 설정하고,
// "등록된 보스만 보기" 토글(기본 ON, [[ADR-031]] 결정 4 승계)로 미등록 보스 사전 설정도 가능하다.
// 리디자인(2026-07-24, 와이어프레임 리뷰): 행을 2줄로 — 1번째 줄은 원형 보스 초상화 + 보스명
// + 파티 스테퍼(우상단 고정), 2번째 줄은 난이도 세그먼트(선택=뱃지/미선택=흐린 같은 뱃지). 선택
// 상태는 체크 없이 카드 테두리·색으로만 나타낸다. 수동 토글 버튼엔 aria-label로 이름을 고정한다.
export function BossManageScreen(): React.JSX.Element {
  const {
    status,
    characters,
    selectedOcid,
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    setPartySize,
    addManualBoss,
    removeManualBoss,
    setManualBossDifficulty,
    // [[ADR-096]] 결정 2: 진입 시점의 스케줄러 탭을 이어받는다(월간에서 들어오면 월간).
    activeTab: schedulerTab,
    // [[ADR-096]] 결정 4: 선택 캐릭터는 스케줄러와 공유한다 — 탭과 달리 두 화면이 갈라지면 안 된다.
    selectCharacter,
  } = useBossSchedulerStore()
  const { mode } = useTrackingModeStore()
  const navigation = useScreenNavigation()
  // [[ADR-096]] 결정 2: 이어받는 것은 **진입 시점 한 번뿐**이다 — 컨텐츠 관리 페이지와 같은 이유로,
  // 이 화면에서의 탭 전환을 스케줄러로 되돌리지 않는다.
  const [activeTab, setActiveTab] = useState<BossTab>(schedulerTab)
  const [onlyRegistered, setOnlyRegistered] = useState(true)
  // 자동 모드에서 행마다 "어느 난이도의 파티 인원을 편집 중인지"를 담는 화면 전용 상태 —
  // 멤버십이 아니므로 저장하지 않는다(수동 모드의 난이도 선택은 멤버십 그 자체라 이걸 안 쓴다).
  const [autoDifficultyByBoss, setAutoDifficultyByBoss] = useState<Record<string, BossDifficulty>>({})

  // 스케줄러를 거치지 않고 직접 진입해도 스토어가 채워지도록 동일하게 로드한다.
  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  // 등록 난이도 조회 — 난이도 기본 선택(등록 난이도 우선)과 자동 모드의 "등록된 보스만 보기"에 쓴다.
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

  // [[ADR-055]] 결정 3: 12는 주간 한도이고 시즌 보스는 예외다 — 카운트 규칙은 lib/boss-matching
  // 한 곳에만 있다(화면이 다시 세면 선택 `12/12` 인데 처치 `11/12` 인 모순이 생긴다).
  const weeklyTrackedCount = countManualWeeklyBosses(trackedBossItems)
  const isWeeklyLimitReached = mode === 'manual' && weeklyTrackedCount >= WEEKLY_BOSS_CLEAR_LIMIT

  function countsTowardWeeklyLimit(bossName: string): boolean {
    return getBossCycleByName(bossName) === 'weekly' && !isSeasonBossName(bossName)
  }

  // [[ADR-056]] 결정 2: 시즌 보스는 챌린저스 월드(챌린저스1~4) 전용 콘텐츠라 그 월드 캐릭터에게만
  // 보여준다. 월드를 모르는 구버전 캐시는 비-챌린저스로 취급한다 — 보스 스케줄러 화면의 시즌
  // 배지가 쓰는 판정과 **같은 함수**여야 두 화면이 갈라지지 않는다.
  const showsSeasonBosses = selected?.world !== undefined && isChallengersWorld(selected.world)
  const allEntries =
    activeTab === 'weekly'
      ? showsSeasonBosses
        ? [...WEEKLY_BOSSES, ...SEASON_BOSSES]
        : WEEKLY_BOSSES
      : MONTHLY_BOSSES
  // 자동 모드 기본은 등록된 보스만 — 단 등록 보스가 하나도 없으면(신규 캐릭터 등) 전체 목록으로
  // 대체해 "미등록 보스 파티 인원 미리 설정"이라는 원래 목적이 막히지 않게 한다([[ADR-031]] 결정 4).
  const registeredEntries = allEntries.filter((entry) => registeredDifficultyByBoss.has(entry.boss))
  const visibleEntries =
    mode === 'auto' && onlyRegistered && registeredDifficultyByBoss.size > 0 ? registeredEntries : allEntries

  // [[ADR-065]] 결정 4: 전에는 try/catch가 없어 저장 실패가 무음이었다 — 체크가 조용히 되돌아가는
  // 것 외에 설명이 없었다. 문구는 컨텐츠 관리 화면과 같다(같은 화면에서 무엇을 토글했는지는
  // 사용자가 안다).
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
    // 한도 초과는 행을 막지 않고 눌렀을 때 토스트로 알린다(사용자 지시) — 흐림은 "고를 수 없다"만
    // 말하고 이유는 시도한 순간에 말한다. 판정은 스토어가 돌려주는 결과를 그대로 쓴다(조건 중복 금지).
    // showError가 아니라 showInfo다: 실패가 아니라 규칙 안내이고, error는 자동 소멸이 없어
    // (duration null) 사용자가 직접 닫아야 한다(사용자 지시 — 경고 톤 + 자동 소멸).
    try {
      const result = await addManualBoss(selected.ocid, bossName, difficulty)
      if (result === 'limitReached') {
        useToastStore.getState().showInfo(`주간 ${WEEKLY_BOSS_CLEAR_LIMIT}개를 모두 선택했어요`)
      }
    } catch {
      useToastStore.getState().showError('추적 목록을 저장하지 못했습니다')
    }
  }

  // 수동 모드의 난이도 변경 = (보스, 난이도) 멤버십 교체. [[ADR-121]] 결정 6: 스토어의 단일 액션이
  // 쓰기 1회로 끝낸다 — remove → add 2단계는 커밋이 2회라 그 사이에 "보스가 목록에 없는" 상태가
  // 저장소에 실재했고, 거기서 실패하면 보스가 통째로 사라졌다. 실패해도 아무것도 안 바뀌므로
  // 여기서 롤백할 것이 없다.
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

  // 콤팩트 스테퍼: 보더 pill 안에 사람 아이콘(파티 표식, 스케줄러 카드와 동일) + −/값/+.
  // 상한은 (보스, 난이도)마다 다르다(스우: 하드 6인 / 익스트림 2인) — 화면이 숫자를 정하지 않고
  // `getMaxPartySize` 에 묻는다([[ADR-006]]).
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
      hasTabBar={false}
      header={
        // 제목~탭~(자동)토글까지 화면 상단에 고정하고 그 아래 보스 목록만 스크롤 — 스케줄러 화면과
        // 동일 패턴(`design-system.md` "스크롤 영역").
        <PageHeader>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Pressable role="button" aria-label="뒤로" onPress={() => navigation.goBack()} className="-ml-1 p-1">
                <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
              </Pressable>
              <Text className="text-lg font-semibold text-text">보스 관리</Text>
            </View>
            {/* [[ADR-096]] 결정 4·5: 읽기 전용 칩이던 자리 — 컨텐츠 관리 페이지와 같은 처리다.
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
          </View>

          {selected !== null && (
            <>
              {mode === 'auto' && (
                <Text className="text-sm text-text-muted">
                  자동 모드에서는 목록이 게임 등록 기준이에요 — 파티 인원만 설정할 수 있어요.
                </Text>
              )}

              <View className="flex-row items-center gap-4">
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
                <Pressable
                  role="button"
                  aria-selected={activeTab === 'monthly'}
                  onPress={() => setActiveTab('monthly')}
                >
                  <Text
                    className={
                      activeTab === 'monthly'
                        ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                        : 'px-3 text-sm font-medium text-text-muted'
                    }
                  >
                    월간
                  </Text>
                </Pressable>

                {/* [[ADR-055]] 결정 8(이슈 #62): 주간 12개 한도 카운터. 주간 탭·수동 모드에만 — 월간
                    보스는 이 한도와 무관하고 자동 모드는 선택 자체가 없다. 스타일은 보스 스케줄러
                    화면의 n/12 배지 재사용(신규 스타일 금지). */}
                {mode === 'manual' && activeTab === 'weekly' && (
                  <Badge tone="primary" className="ml-auto" style={TABULAR_NUMS}>
                    {weeklyTrackedCount}/{WEEKLY_BOSS_CLEAR_LIMIT}
                  </Badge>
                )}
              </View>

              {mode === 'auto' && (
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-xs font-medium text-text-muted">등록된 보스만 보기</Text>
                  <Pressable
                    role="switch"
                    aria-checked={onlyRegistered}
                    aria-label="등록된 보스만 보기"
                    onPress={() => setOnlyRegistered((prev) => !prev)}
                    className={`relative h-6 w-11 shrink-0 rounded-full ${
                      onlyRegistered ? 'bg-primary' : 'bg-surface-2'
                    }`}
                  >
                    <View
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface ${
                        onlyRegistered ? 'translate-x-5' : 'translate-x-0'
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
        {/* [[ADR-061]] 결정 10: 조회가 끝나기 전(idle·loading)에는 빈 상태 문구로 위장하지 않는다. */}
        {selected === null && (status === 'idle' || status === 'loading') ? (
          <View className="px-4 pb-4">
            <LoadingState size="page" message="불러오고 있어요" />
          </View>
        ) : selected === null ? (
          <View className="px-4 pb-4">
            <Text className="text-sm text-text-muted">
              캐릭터를 먼저 선택해주세요 — 보스 스케줄러의 "캐릭터 관리"에서 추가할 수 있어요.
            </Text>
          </View>
        ) : (
          <View className="gap-2 px-4 pb-4">
            {visibleEntries.map((entry) => {
              const trackedDifficulty = mode === 'manual' ? trackedDifficultyOf(entry.boss) : null
              const isTracked = trackedDifficulty !== null

              // [[ADR-055]]: 한도가 찼을 때 미선택 행은 흐리게만 둔다 — 비활성화하지 않는다.
              // 눌러야 이유(토스트)를 알릴 수 있고, 이미 선택된 행은 애초에 대상이 아니다.
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

              // 흐림은 행 컨테이너가 아니라 안쪽 내용에만 건다 — 컨테이너에 걸면 그 위에 얹는
              // 안내(스크림 문구)까지 함께 흐려져 읽히지 않는다.
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
        )}
      </View>
    </ScreenScroll>
  )
}
