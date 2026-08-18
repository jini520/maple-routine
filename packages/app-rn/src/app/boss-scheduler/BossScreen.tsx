// 보스 스케줄러 — 주간/월간 보스 진행 상태(`docs/features/boss-scheduler.md`).
//
// **이 화면에 걸린 ADR 이 스물여섯이다** — 저장소에서 `BossProfitScreen` 다음으로 무겁다. 대부분은
// 화면에 안 보이는 판단이라(완료 승격 · 시즌 보스 판정 · 실패의 목적지 · 빈 상태의 판정 시점) 아래
// 주석이 그 자리를 지목한다. 목록은 `docs/migration/parity-inventory.md` §2.4.
//
// ══ RN 으로 옮기며 **사라진** 것 넷 — 컨텐츠 스케줄러와 같다 ═══════════════════════════
//
// ① **`usePullToRefresh` 훅과 `PullToRefreshIndicator`**([[ADR-130]] 결정 1). 당김을
//    `RefreshControl` 이 맡는다. **step 4 와 같은 배선이어야 한다** — 두 탭이 같은 제스처에 다르게
//    반응하면 그 자체가 회귀다. [[ADR-072]] 결정 2·10 과 [[ADR-073]] 결정 1 은 그대로 지켜지고
//    ([[ADR-073]] 은 RN 에서 헤더가 스크롤 뷰의 **형제**라 애초에 안 움직인다), [[ADR-074]] 의 마크
//    결정 넷이 폐기되는 자리가 [[ADR-130]] 이다.
// ② **`resolveContentOffsetPx` 로 목록을 내리던 `transform`**([[ADR-073]] 결정 6) — OS 가 한다.
// ③ **`useScreenStackStore` 의 깊이로 당김을 끄던 배선**([[ADR-120]] 결정 10). 하위 페이지는 루트
//    스택에 **덮여** 올라오므로 아래 화면의 스크롤 뷰에 손가락이 닿지 않는다.
// ④ **`<Outlet />`**([[ADR-077]] 언마운트 금지). 관리 페이지는 형제 라우트가 아니라 **형제 탭**이라
//    ([[ADR-145]] 결정 1 — 그전에는 루트 스택 push 였다) 이 화면이 트리에 그대로 남는다 — 계약을
//    코드가 아니라 내비게이터가 지킨다.
//
// ══ 갈린 것 다섯 ═══════════════════════════════════════════════════════════════════
//
// ① `useNavigate('/boss/manage')` → `navigation.navigate('Tabs', { screen: 'BossManage' })`.
//    **[[ADR-098]] 결정 1(이동 전에 스크롤을 0으로)은 함께 사라진다** — 그 처방이 풀던 것은 네 탭이
//    문서 스크롤 하나를 공유하던 문제이고([[ADR-099]]), RN 에서는 스크롤이 화면과 함께 죽어 계승할
//    오프셋이 없다. **목적지가 push 가 아니라 형제 탭인 것은 [[ADR-145]] 결정 1 이다** — 그래서
//    이 화면의 헤더에는 그리로 가는 버튼이 아예 없고, 남은 호출부는 빈 상태 CTA 하나다.
// ② **캐릭터 관리 피커가 이 화면에 없다**([[ADR-140]]). 헤더 버튼도, 그것이 열던 모달도, 그 모달을
//    먹여 살리던 로스터 조회([[ADR-015]]·[[ADR-016]]·[[ADR-053]]·[[ADR-062]])도, 웹의 `?openPicker=1`
//    을 받던 라우트 파라미터도 **설정 화면으로 통째로 옮겨갔다** — 추적 목록은 [[ADR-042]] 이후 앱
//    전역 하나인데 그것을 고르는 자리만 다섯이었다. 남은 흔적은 빈 상태 CTA 하나이고, 그것도 모달이
//    아니라 **설정 탭을 피커가 열린 채로** 연다.
// ③ **카드 눌림 피드백이 절반만 온다**([[ADR-121]] 결정 1 — 이 카드의 **유일한** 어포던스다).
//    `active:scale-[.985]` 는 NativeWind 가 그대로 낸다(실측). `active:brightness-110` 은 **조용히
//    사라진다** — NativeWind 가 `brightness-*` 를 네이티브 `filter` 로 내보내지 않는다. 탈출구인
//    `style={({pressed}) => …}` 함수도 못 쓴다: NativeWind 가 `Pressable` 의 style **함수를 통째로
//    삼킨다**(className 이 없어도 그렇다 — 실측). 남는 길은 `onPressIn/Out` 상태를 카드마다 두는
//    것뿐인데, 눌림을 알리는 일은 축소가 이미 하므로 그 값을 치르지 않는다(육안 대조 목록).
// ④ `<button>` → `Pressable` + `Text`, `hover:` 는 사라진다(RN 에 호버가 없다).
// ⑤ `animate-spin` → Reanimated CSS 애니메이션(`lib/animation.ts`). step 4 가 화면 안 상수로 두며
//    *"보스 스케줄러가 붙는 step 5 에서 둘이 된다"* 고 적어 둔 자리라, 여기서 `lib/` 로 올렸다
//    ([[ADR-094]] 결정 1).
import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReducedMotion } from 'react-native-reanimated'

import type { BossDifficulty } from '@core/types'
import {
  partySizeKey,
  useBossSchedulerStore,
  type PartyFilter,
} from '@core/features/boss-scheduler/store'
import { displayedBosses } from '@core/features/boss-scheduler/displayed-bosses'
import { formatSyncedAt } from '@core/features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '@core/features/schedule-sync/use-sync-error-toast'
import { useToastStore } from '@core/features/toast/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { getBossPortraitCrop, getBossPortraitUrl, type BossPortraitCrop } from '@core/lib/boss-icons'
import { getSupportedDifficulties, type MatchedBoss } from '@core/lib/boss-matching'
import { getMaxPartySize } from '@core/lib/boss-crystal-prices'
import { isChallengersWorld } from '@core/lib/world-emblem'

import { Badge } from '../../components/atoms/Badge/Badge'
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { CharacterRail, type CharacterRailEntry } from '../../components/molecules/CharacterRail/CharacterRail'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { MediaCard, MediaCardArt } from '../../components/molecules/MediaCardArt/MediaCardArt'
import { PartySizeModal } from '../../components/organisms/PartySizeModal/PartySizeModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../lib/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { RefreshCwIcon, SlidersHorizontalIcon, SwordsIcon, UsersIcon } from '../../lib/icons'
import { MEDIA_TEXT_SHADOW_STYLE } from '../../lib/text-styles'
import { orderByTracked } from '../../lib/tracked-order'
import { useThemeAppearance } from '../../theme/context'
import { useScreenNavigation } from '../use-screen-navigation'

const PARTY_FILTER_LABELS: Record<PartyFilter, string> = {
  all: '전체',
  solo: '솔로',
  party: '파티',
}

function BossCard(props: {
  boss: MatchedBoss
  crop?: BossPortraitCrop
  partySize?: number
  onEdit: () => void
}): React.JSX.Element {
  const { boss, partySize } = props
  const portraitUrl = getBossPortraitUrl(boss.portraitSlug)
  const crop = props.crop ?? getBossPortraitCrop(boss.portraitSlug)
  const bossName = boss.matchedBossName ?? boss.apiName

  // 카드 배경/보더/보스명 텍스트는 페이지 표면이 아니라 일러스트 위 배색을 따른다 — bleed·페이드·
  // text-shadow가 어두운 배경을 전제로 튜닝됐기 때문에 라이트 테마에서 페이지 토큰(bg-surface 등)을
  // 쓰면 대비가 깨진다. `MediaCard` 가 카드 안쪽의 기준 표면을 media-surface로 바꾸므로
  // ([[ADR-064]] 결정 5) 안에서는 앱 전역과 같은 레시피(bg-surface-2·text-text)를 그대로 쓴다.
  // 완료 뱃지는 앱 전체가 공유하는 "완료/성공" 의미 색(secondary)이라 스코프 안에서도 그대로다.
  // [[ADR-121]] 결정 1: 카드 전면(80px)이 버튼이다. **어포던스 표식을 두지 않는다** — 셰브런·연필을
  // 얹지 않고 눌림 피드백만 준다([[ADR-018]] 카드 규격 무변경과 맞바꾼 값). 완료된 보스도 눌린다:
  // 파티 인원은 완료 여부와 무관한 상시 데이터다([[ADR-019]]).
  return (
    <Pressable
      role="button"
      aria-label={`${bossName} 파티 설정`}
      onPress={props.onEdit}
      // 밝기 몫은 못 온다(파일 머리 ③) — 축소만 남는다.
      className="rounded-[14px] active:scale-[.985]"
    >
      <MediaCard className="relative h-20 overflow-hidden">
        <MediaCardArt source={portraitUrl} crop={crop} />

        <View className="h-full flex-row items-center justify-between px-[14px]">
          <View className="flex-row items-center gap-2">
            <DifficultyBadge difficulty={boss.difficulty} />
            <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
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
            {boss.isComplete && (
              <Text className="rounded-full bg-secondary-tint px-2.5 py-1 text-xs font-bold text-secondary-ink">
                완료
              </Text>
            )}
          </View>
        </View>
      </MediaCard>
    </Pressable>
  )
}

export function BossScreen(): React.JSX.Element {
  const {
    status,
    characters: storeCharacters,
    error,
    trackedOcids,
    selectedOcid,
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    refresh,
    selectCharacter,
    // [[ADR-121]]: 카드 탭 모달이 쓰는 두 액션. 파티 인원은 두 모드 공통이고, 난이도 교체는 수동
    // 모드에서만 멤버십을 바꾼다.
    setPartySize,
    setManualBossDifficulty,
    // [[ADR-096]] 결정 1: 탭과 두 필터는 스토어 소유다 — 이 화면이 언마운트돼도 살아남고, 관리
    // 페이지가 같은 탭 값을 읽어 보던 탭 그대로 열린다.
    activeTab,
    setActiveTab,
    // [[ADR-019]] 결정 6: 주간/월간 탭은 서로 독립된 필터 상태를 갖는다(한 탭의 필터 변경이
    // 다른 탭에 영향을 주지 않음).
    weeklyFilter,
    setWeeklyFilter,
    monthlyFilter,
    setMonthlyFilter,
  } = useBossSchedulerStore()
  const { mode } = useTrackingModeStore()
  const navigation = useScreenNavigation()
  const insets = useSafeAreaInsets()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()
  // [[ADR-121]]: 카드 탭으로 여는 파티 인원 모달. 편집 중인 난이도를 함께 들고 있는 이유는
  // openPartyModal 주석 참고.
  const [partyModal, setPartyModal] = useState<{ boss: MatchedBoss; difficulty: BossDifficulty } | null>(null)
  // [[ADR-063]]: 동기화 전체 실패는 인라인 문단이 아니라 토스트로 알린다 — 지속 상태("n분 전")는
  // 새로고침 옆 표기가 이미 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // [[ADR-101]] 결정 1: `null` 은 "0명"이 아니라 **"저장소를 아직 안 읽었다"** 다. 둘을 `||` 로 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다(실기기 2026-08-06 — "표시할 캐릭터가
  // 없습니다"가 목록보다 먼저 한 프레임 스쳤다). 빈 상태는 읽고 0명임을 **확인한 뒤에만** 그린다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

  // [[ADR-143]] 결정 3: 스토어가 내는 것은 **기준 순서**(레벨 내림차순)이고, 화면 순서는 사용자가
  // 캐릭터 관리에서 정한 저장 배열 순서다. core 를 안 고치는 이유는 `orderByTracked` 머리에 있다.
  const characters = orderByTracked(storeCharacters, trackedOcids ?? [])

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  // [[ADR-083]] 결정 1: 캐릭터별 실패도 인라인 문단이 아니라 토스트다. syncSchedules는 캐릭터 단위
  // 실패를 던지지 않고 결과에 실어 반환하므로(401/429는 나머지 캐릭터까지 같은 에러로 채운다)
  // 실패의 대부분이 위의 전역 error가 아니라 이 값으로 온다 — 두 훅이 동시에 울릴 조합은 없다
  // (전역 error가 채워지는 경로에서는 characters가 캐시 뷰로 교체되고 그 뷰의 error는 null이다).
  useScheduleSyncErrorToast(selected?.error ?? null, { onRetry: () => refresh(trackedOcids ?? []) })

  // 카드로 표시할 목록 — [[ADR-035]] 수동 모드 멤버십과 [[ADR-031]] 결정 5(미등록이어도 완료면
  // 포함)가 그 안에 있다. **이 화면의 지역 함수였던 것을 코어로 꺼냈다**([[ADR-147]] 결정 8) —
  // today 의 「캐릭터별 남은 스케줄」이 세는 «남은 보스» 가 이 화면이 보여 주는 것과 한 글자도
  // 달라선 안 되기 때문이다. 이유·규칙·«캐릭터를 인자로 받는» 근거는 `displayed-bosses.ts` 파일 머리.
  const displayedWeeklyBosses =
    selected === null ? [] : displayedBosses(selected, 'weekly', mode, manualTrackedByOcid)
  const displayedMonthlyBosses =
    selected === null ? [] : displayedBosses(selected, 'monthly', mode, manualTrackedByOcid)

  // [[ADR-142]] 정정 1: 링은 **주간 하나**다(온전한 원). 월간은 종류가 하나뿐이라 «몇 개 중 몇 개»
  // 가 뜻을 갖지 못한다 — 표현 방법은 따로 정한다(사용자 지시, 2026-08-16).
  // **솔로/파티 필터는 안 탄다**(결정 4) — 필터는 «지금 보고 싶은 것» 이지 진행이 아니다.
  const bossRingProgress = (bosses: MatchedBoss[]): { completed: number; total: number } => ({
    completed: bosses.filter((boss) => boss.isComplete).length,
    total: bosses.length,
  })

  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    rings: [
      { label: '주간', ...bossRingProgress(displayedBosses(character, 'weekly', mode, manualTrackedByOcid)) },
    ],
  }))

  // 챌린저스 월드면 registration_flag와 무관하게 시즌 보스 완료 여부를 배지로 보여준다([[ADR-031]] 결정 3).
  // **판정은 `isChallengersWorld` 가 한다** — 화면이 월드 이름을 다시 뜯지 않는다(관리 페이지가
  // 시즌 보스를 목록에 넣는 판정과 같은 함수여야 두 화면이 갈라지지 않는다, [[ADR-056]] 결정 2).
  const seasonBosses =
    selected !== null && selected.world !== undefined && isChallengersWorld(selected.world)
      ? selected.weeklyBosses.filter((boss) => boss.isSeasonBoss)
      : []
  const isSeasonBossComplete = seasonBosses.some((boss) => boss.isComplete)

  function getPartySize(ocid: string, boss: MatchedBoss): number | undefined {
    const bossName = boss.matchedBossName ?? boss.apiName
    return partySizes[partySizeKey(ocid, bossName, boss.difficulty)]
  }

  // [[ADR-019]] 결정 3: boss_party_settings에 없는 조합은 솔로(1인) 취급 — 별도 API 재호출
  // 없이 이미 로드된 partySizes 맵으로만 클라이언트 사이드 필터링한다.
  function filterByPartySize(bosses: MatchedBoss[], ocid: string, filter: PartyFilter): MatchedBoss[] {
    if (filter === 'all') return bosses
    return bosses.filter((boss) => {
      const size = getPartySize(ocid, boss) ?? 1
      return filter === 'party' ? size >= 2 : size <= 1
    })
  }

  const activeFilter = activeTab === 'weekly' ? weeklyFilter : monthlyFilter
  const filteredWeeklyBosses =
    selected !== null ? filterByPartySize(displayedWeeklyBosses, selected.ocid, weeklyFilter) : []
  const filteredMonthlyBosses =
    selected !== null ? filterByPartySize(displayedMonthlyBosses, selected.ocid, monthlyFilter) : []

  function renderBossCards(bosses: MatchedBoss[], ocid: string): React.JSX.Element {
    return (
      <View className="gap-2">
        {bosses.map((boss) => (
          <BossCard
            key={`${boss.apiName}-${boss.difficulty}`}
            boss={boss}
            partySize={getPartySize(ocid, boss)}
            onEdit={() => openPartyModal(boss)}
          />
        ))}
      </View>
    )
  }

  // [[ADR-121]]: 카드를 탭하면 열리는 파티 인원·난이도 모달.
  //
  // 편집 중인 난이도를 **모달이 따로 들고 있다** — 수동 모드에서 난이도를 바꾸면 멤버십이 바뀌어
  // 카드가 다시 그려지지만, 자동 모드에서는 카드가 그대로라 스토어만으로는 "지금 무엇을 편집
  // 중인지"를 알 수 없다(결정 3: 자동 모드의 전환은 멤버십이 아니라 편집 대상 전환이다).
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

  // 수동 모드에서만 멤버십이 바뀐다. 자동 모드는 편집 대상만 옮긴다 — 카드의 난이도는 게임 등록
  // 기준이라 앱이 못 바꾼다.
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

  // [[ADR-140]] 결정 1·2: 이 화면은 더 이상 피커를 열지 않는다 — 추적 목록을 고르는 자리는 설정
  // 하나뿐이라, 빈 상태 CTA 는 모달 대신 **설정 탭을 피커가 열린 채로** 연다.
  function goToCharacterManage(): void {
    navigation.navigate('Tabs', { screen: 'Settings', params: { openPicker: true } })
  }

  // [[ADR-035]] 결정 18 이 만든 헤더 진입점("보스 관리")은 **여기 없다**([[ADR-145]] 결정 1) —
  // 그 화면이 스케줄 그룹의 하위 탭이 되면서 진입 자리를 하단바가 가져갔다. [[ADR-140]] 이 걷은
  // "캐릭터 관리"에 이어 제목 줄의 두 번째이자 마지막 버튼이 사라진 것이라, 이제 그 줄에서 폭을
  // 다투는 상대가 없다([[ADR-141]] 결정 3의 `shrink-0` 짝이 하나만 남는다).
  //
  // 남는 것은 빈 상태 CTA 하나이고, 그것도 push 가 아니라 **형제 탭**으로 보낸다.
  function goToBossManage(): void {
    navigation.navigate('Tabs', { screen: 'BossManage' })
  }

  // [[ADR-060]]: 빈 상태 문구는 탭(주간/월간)과 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다 —
  // 자동 모드가 지시하는 곳("게임에서 등록")은 앱 밖이라 데려다줄 수 없다.
  function bossEmptyProps(tab: 'weekly' | 'monthly'): React.ComponentProps<typeof EmptyState> {
    const label = tab === 'weekly' ? '주간' : '월간'
    if (mode === 'manual') {
      return {
        icon: SwordsIcon,
        title: `추적할 ${label} 보스가 없습니다`,
        description: `보스 관리에서 이번 ${tab === 'weekly' ? '주' : '달'}에 잡을 보스를 골라주세요`,
        action: { label: '보스 관리', onClick: goToBossManage },
      }
    }
    return {
      icon: SwordsIcon,
      title: `등록된 ${label} 보스가 없습니다`,
      description: '게임 내 스케줄러에 등록하면 여기에 자동으로 표시됩니다',
    }
  }

  // 보스가 0건인 빈 상태와 달리 "필터가 가린 상태"라 CTA는 필터를 되돌린다([[ADR-060]] 결정 3).
  function filterEmptyProps(tab: 'weekly' | 'monthly'): React.ComponentProps<typeof EmptyState> {
    return {
      icon: SlidersHorizontalIcon,
      title: '이 조건에 해당하는 보스가 없습니다',
      description: '솔로·파티 필터를 해제하면 전체 보스를 볼 수 있습니다',
      action: {
        label: '필터 초기화',
        onClick: () => (tab === 'weekly' ? setWeeklyFilter('all') : setMonthlyFilter('all')),
      },
    }
  }

  if (isEmpty) {
    // 헤더 셸을 쓰지 않는 가지라(제목 줄이 목록 없이 혼자 선다) 상단 안전영역을 여기서 먹는다 —
    // 웹의 `min-h-[calc(100dvh …)]` 자리는 `flex-1` 이다(탭 상자가 이미 탭바를 뺀 크기다).
    return (
      <View testID="screen-Boss" className="flex-1 p-4" style={{ paddingTop: insets.top }}>
        {/* 헤더 셸을 안 쓰는 가지에서도 제목 줄은 같은 프리미티브다([[ADR-145]] 정정 1) — 빈 상태와
            목록 상태를 오갈 때 제목이 튀면 그것이 가장 눈에 띄는 자리다. */}
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
        // [[ADR-130]] 결정 1·3: 당김은 헤더 버튼과 **같은 재조회**를 부르고([[ADR-072]] 결정 2), 색만
        // 테마에서 넘긴다. 컨텐츠 스케줄러와 **같은 배선이어야 한다** — 두 탭이 같은 제스처에
        // 다르게 반응하면 그 자체가 회귀다.
        refreshControl={
          <RefreshControl
            refreshing={status === 'loading'}
            onRefresh={() => refresh(trackedOcids ?? [])}
            tintColor={definition.primaryInk}
            colors={[definition.primaryInk]}
            progressBackgroundColor={definition.surface}
          />
        }
        header={
          // 필터까지(제목~탭~솔로/파티 필터)는 화면 상단에 고정하고 그 아래 보스 목록만 스크롤되게
          // 한다. RN 에서 헤더는 스크롤 뷰의 **형제**라 `fixed` 도 spacer 도 없다([[ADR-098]] 결정 2 가
          // 웹에서 풀던 문제가 구조적으로 없다 — `PageHeader` 파일 머리).
          <PageHeader>
            {/* [[ADR-141]] 결정 1·3: 동기화 상태가 드롭다운 줄에서 **제목 옆**으로 올라왔고, 폭을
                다투면 시각 텍스트만 줄어든다(제목·새로고침은 `shrink-0`). 오른쪽 끝에서 자리를 지키던
                관리 버튼이 [[ADR-145]] 결정 1 로 사라져 바깥 `justify-between` 줄도 함께 걷었다 —
                가를 상대가 없는 줄에서 그 속성은 아무 일도 하지 않는다. */}
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

            {/* 조건이 **줄 밖**에 있다 — 컨텐츠 스케줄러와 같은 이유다(그 파일의 같은 자리):
                안에 두면 캐릭터가 없는 동안 빈 줄이 `gap-4` 를 두 번 먹는다. */}
            {characters.length > 0 && selected !== null && (
              <CharacterRail
                entries={railEntries}
                selectedOcid={selected.ocid}
                onSelect={(ocid) => {
                  void selectCharacter(ocid)
                }}
              />
            )}

            {/* [[ADR-016]]: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
                셸 승계 카드는 보여줄 데이터가 아예 없을 때만 그린다([[ADR-061]] 결정 2). */}
            {(status === 'idle' || status === 'loading') && characters.length === 0 && (
              <LoadingState size="page" message="불러오고 있어요" />
            )}

            {characters.length > 0 && selected !== null && (
              <>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <Pressable
                      role="button"
                      aria-selected={activeTab === 'weekly'}
                      onPress={() => setActiveTab('weekly')}
                    >
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
                  </View>

                  {activeTab === 'weekly' && (
                    <View className="flex-row items-center gap-2">
                      {seasonBosses.length > 0 && (
                        <Text
                          className={
                            isSeasonBossComplete
                              ? 'rounded-full bg-secondary-tint px-2.5 py-1 text-xs font-bold text-secondary-ink'
                              : 'rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary-ink'
                          }
                        >
                          {`season ${isSeasonBossComplete ? '완료' : '미완료'}`}
                        </Text>
                      )}
                      {selected.weeklyBossClearCount !== null &&
                        selected.weeklyBossClearLimitCount !== null && (
                          <Badge tone="primary">
                            {selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}
                          </Badge>
                        )}
                    </View>
                  )}
                </View>

                <View className="flex-row items-center gap-2">
                  {(['all', 'solo', 'party'] as const).map((filter) => (
                    <Pressable
                      key={filter}
                      role="button"
                      aria-selected={activeFilter === filter}
                      onPress={() =>
                        activeTab === 'weekly' ? setWeeklyFilter(filter) : setMonthlyFilter(filter)
                      }
                    >
                      <Text
                        className={
                          activeFilter === filter
                            ? 'rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary-ink'
                            : 'px-3 text-xs font-medium text-text-muted'
                        }
                      >
                        {PARTY_FILTER_LABELS[filter]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </PageHeader>
        }
      >
        {characters.length > 0 && selected !== null && (
          <View testID="pull-content" className="gap-4 px-4 pb-4">
            {activeTab === 'weekly' && (
              <>
                {displayedWeeklyBosses.length === 0 && (mode === 'manual' || !selected.isStale) && (
                  <EmptyState {...bossEmptyProps('weekly')} />
                )}

                {displayedWeeklyBosses.length > 0 && filteredWeeklyBosses.length === 0 && (
                  <EmptyState {...filterEmptyProps('weekly')} />
                )}

                {filteredWeeklyBosses.length > 0 && renderBossCards(filteredWeeklyBosses, selected.ocid)}
              </>
            )}

            {activeTab === 'monthly' && (
              <>
                {displayedMonthlyBosses.length === 0 && (mode === 'manual' || !selected.isStale) && (
                  <EmptyState {...bossEmptyProps('monthly')} />
                )}

                {displayedMonthlyBosses.length > 0 && filteredMonthlyBosses.length === 0 && (
                  <EmptyState {...filterEmptyProps('monthly')} />
                )}

                {filteredMonthlyBosses.length > 0 && renderBossCards(filteredMonthlyBosses, selected.ocid)}
              </>
            )}
          </View>
        )}
      </ScreenScroll>

      {partyModal !== null && selected !== null && modalBossName !== null && (
        <PartySizeModal
          bossName={modalBossName}
          cycleLabel={partyModal.boss.cycle === 'monthly' ? '월간 보스' : '주간 보스'}
          portraitSlug={partyModal.boss.portraitSlug}
          // 참조표에 없는 보스(매칭 실패 원문명)는 후보를 알 수 없다 — 지금 난이도 하나만 그려
          // 세그먼트가 통째로 사라지지 않게 한다.
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
