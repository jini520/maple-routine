// 보스 관리 — 추적 편집(수동)과 파티 인원 설정([[ADR-035]] 결정 18).
//
// ══ RN 으로 옮기며 갈린 것 다섯 ═══════════════════════════════════════════════════
//
// ① **`StackScreen` 이 통째로 사라진다**([[ADR-120]]). 포털 오버레이·푸시/팝 전환·가장자리 스와이프·
//    탭바 밀어내기 넷이 전부 루트 스택의 성질이라, 셸은 `ScreenScroll` + `PageHeader` 다(컨텐츠
//    관리·설정 하위 화면과 같은 골격). **`hasTabBar={false}` 는 [[ADR-145]] 결정 1 로 없어졌다** —
//    이 화면이 하위 페이지가 아니라 **탭**이 되어 아래에 바가 뜬다.
// ② ~~`useStackBack(PARENT_PATH)` → `goBack()`~~ → **뒤로가기 자체가 이 화면에 없다**([[ADR-145]]
//    결정 1). 탭이라 pop 할 스택이 없고, 그 일은 하단바의 ← 가 진다([[ADR-132]] 결정 3). 그래서
//    화면의 헤더에는 제목만 남고 `useScreenNavigation` 도 안 부른다.
// ③ `<button aria-pressed>` → `Pressable` + **`aria-selected`**(RN 접근성 상태에 *pressed* 가 없다).
// ④ **파티 스테퍼가 인라인 마크업에서 `PartySizeStepper`(molecule) 로 접힌다.** 3단계가 웹의 두
//    호출부(이 화면 · 파티 인원 모달)를 한 컴포넌트로 모아 두었으므로([[ADR-121]] 결정 7) 여기서는
//    `size="compact"` 로 부르기만 한다 — 웹에 남아 있던 복붙 한 벌이 그때 없어졌다.
// ⑤ **모든 보스 보기 토글이 손으로 그린 스위치 그대로다**(웹에서는 "등록된 보스만 보기" — 이름과
//    방향이 [[ADR-145]] 결정 4 로 뒤집혔고 **표시 결과는 같다**). 웹의 `role="switch"` +
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
import { CharacterRail, type CharacterRailEntry } from '../../components/molecules/CharacterRail/CharacterRail'
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

// 관리 페이지의 보스 목록은 게임 레퍼런스 데이터(weekly-bosses.json) 그대로다 — 주간 탭은
// 주간(+챌린저스 월드에 한해 시즌 주간), 월간 탭은 월간([[ADR-035]] 결정 18, [[ADR-056]]). 난이도
// 후보도 같은 파일의 difficulties를 쓴다(폐기된 ManualBossPickerModal과 동일 소스).
// [[ADR-056]] 결정 1: 미출시 보스(status: 'unreleased')는 목록에서 뺀다. 보스명을
// 코드에 박지 않고 데이터의 status로 거르므로, 출시되면 그 필드를 지우는 것만으로 되돌아온다.
// 벨로나 출시([[ADR-151]])가 실제로 그렇게 지나가 지금 이 필터에 걸리는 엔트리는 0개다 —
// 다음 미출시 보스를 위해 그대로 둔다([[ADR-151]] 결정 4).
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
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    setPartySize,
    addManualBoss,
    removeManualBoss,
    setManualBossDifficulty,
    // **탭은 여기 없다**([[ADR-164]] 결정 4) — 스케줄러가 한 목록이 되면서 이 화면의 탭도 함께
    // 걷혔다. [[ADR-096]] 결정 2 와 [[ADR-145]] 결정 2(«승계가 아니라 공유»)가 폐기된 자리다.
    // [[ADR-096]] 결정 4: 선택 캐릭터는 스케줄러와 공유한다 — 두 화면이 갈라지면 안 된다.
  } = useBossSchedulerStore()
  // 선택은 화면·스토어가 아니라 **여기 한 벌**이다([[ADR-159]] 결정 1).
  const { selectedOcid, select } = useCharacterSelectionStore()
  const { mode } = useTrackingModeStore()
  // [[ADR-145]] 결정 4: 스위치가 뒤집혔다 — 「등록된 보스만 보기」(기본 켜짐) → 「모든 보스 보기」
  // (기본 꺼짐). **표시 결과는 안 바뀐다**(기본은 여전히 등록된 보스만). 켜진 스위치가 «거른다» 를
  // 뜻하면 «끄면 더 보인다» 가 되어 방향이 뒤집혀 읽힌다.
  const [showAllBosses, setShowAllBosses] = useState(false)
  // 자동 모드에서 행마다 "어느 난이도의 파티 인원을 편집 중인지"를 담는 화면 전용 상태 —
  // 멤버십이 아니므로 저장하지 않는다(수동 모드의 난이도 선택은 멤버십 그 자체라 이걸 안 쓴다).
  const [autoDifficultyByBoss, setAutoDifficultyByBoss] = useState<Record<string, BossDifficulty>>({})

  // 스케줄러를 거치지 않고 직접 진입해도 스토어가 채워지도록 동일하게 로드한다.
  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // [[ADR-055]] 결정 3: 12는 주간 한도이고 시즌 보스는 예외다 — 카운트 규칙은 lib/boss/boss-matching
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
  // **무리 둘이고 월간이 위다**([[ADR-164]] 결정 1·4) — 스케줄러 목록과 같은 순서여야 «보는 화면과
  // 편집 화면이 같은 목록» 이 성립한다(그 순서의 출처는 `displayed-bosses` 의 `BOSS_SECTION_ORDER`).
  const allSections = BOSS_SECTION_ORDER.map((cycle) => ({
    cycle,
    entries:
      cycle === 'monthly'
        ? MONTHLY_BOSSES
        : showsSeasonBosses
          ? [...WEEKLY_BOSSES, ...SEASON_BOSSES]
          : WEEKLY_BOSSES,
  }))
  // 자동 모드 기본은 등록된 보스만 — 단 등록 보스가 하나도 없으면(신규 캐릭터 등) 전체 목록으로
  // 대체해 "미등록 보스 파티 인원 미리 설정"이라는 원래 목적이 막히지 않게 한다([[ADR-031]] 결정 4).
  // **[[ADR-145]] 결정 4 는 그 규칙을 그대로 승계한다** — 뒤집힌 것은 스위치의 방향과 이름뿐이라
  // 이 판정이 내는 목록은 전과 한 글자도 다르지 않다.
  //
  // **판정은 무리별이 아니라 목록 전체로 한다** — `registeredDifficultyByBoss.size` 는 두 무리를
  // 합쳐 센 값이라, 검마만 등록한 캐릭터의 주간 무리가 «등록이 0이니 전체 목록» 으로 부풀지 않는다.
  const showsRegisteredOnly =
    mode === 'auto' && !showAllBosses && registeredDifficultyByBoss.size > 0
  const visibleSections = allSections
    .map((section) => ({
      ...section,
      entries: showsRegisteredOnly
        ? section.entries.filter((entry) => registeredDifficultyByBoss.has(entry.boss))
        : section.entries,
    }))
    // 무리가 비면 헤더도 안 선다([[ADR-164]] 결정 6). 스케줄러와 달리 여기서는 예외가 없다 —
    // 「주간」 헤더가 싣는 `n/12` 는 **수동 모드에서 고른 개수**라, 고를 행이 하나도 없으면 그
    // 수치를 보여 줄 이유도 없다(스케줄러 쪽은 게임이 세는 처치 수라 목록과 무관하다).
    .filter((section) => section.entries.length > 0)

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
      header={
        // 제목~(자동)토글도 목록과 **함께 스크롤된다**([[ADR-131]]) — 헤더는 `ScreenScroll` 의 첫
        // 자식이다. 스케줄러 화면과 같은 패턴이다(`design-system.md` "스크롤 영역").
        <PageHeader>
          {/* **← 가 없다**([[ADR-145]] 결정 1) — 이 화면은 하위 페이지가 아니라 스케줄 그룹의 하위
              탭이라 pop 할 스택이 없고, 뒤로 가는 일은 하단바가 진다([[ADR-132]] 결정 3). 같은 이유로
              `hasTabBar` 도 기본값(참)으로 돌아왔다 — 이제 바가 이 화면 아래에 뜬다.

              줄이 제목 하나뿐이어도 `PageHeaderTitleRow` 를 쓴다(정정 1) — 그 최소 높이가 곧 «옆
              탭과 같은 선» 이고, 여기서 그것을 빼면 보스 스케줄러와 2px 어긋난다. */}
          <PageHeaderTitleRow>
            <Text className="text-lg font-semibold text-text">보스 관리</Text>
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
            <>
              {/* [[ADR-035]] 결정 18 의 안내 한 줄("자동 모드에서는 목록이 게임 등록 기준이에요 —
                  파티 인원만 설정할 수 있어요")은 [[ADR-145]] 결정 3 으로 사라졌다 — 화면이 이미
                  그것을 보여 준다(체크가 없고 스테퍼만 있다). 설명은 기능 안내가 계속 진다. */}
              {/* [[ADR-164]] 결정 4: **주간/월간 탭이 여기 있었다.** 스케줄러와 함께 걷혔고,
                  탭에만 매달려 있던 `n/12` 카운터는 「주간」 섹션 헤더로 내려갔다(결정 3). */}

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
            {visibleSections.map((section) => (
              <View key={section.cycle} className="gap-2">
                {/* 스케줄러 헤더(`BossScreen`)와 같은 모양을 쓴다. 두 화면의 무리 머리가 갈리면
                    같은 목록으로 안 읽힌다. 시즌 배지는 여기 없다. 그것은 진행이고 이 화면은
                    편집이다. `n/12` 도 여기서는 고른 개수라 뜻이 다르다. */}
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
            ))}
          </View>
        )}
      </View>
    </ScreenScroll>
  )
}
