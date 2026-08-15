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
// ④ **`<Outlet />`**([[ADR-077]] 언마운트 금지). 관리 페이지는 형제 라우트가 아니라 루트 스택
//    push 라 이 화면이 트리에 그대로 남는다 — 계약을 코드가 아니라 내비게이터가 지킨다.
//
// ══ 갈린 것 다섯 ═══════════════════════════════════════════════════════════════════
//
// ① `useNavigate('/boss/manage')` → `navigation.navigate('BossManage')`. **[[ADR-098]] 결정 1
//    (이동 전에 스크롤을 0으로)은 함께 사라진다** — 그 처방이 풀던 것은 네 탭이 문서 스크롤 하나를
//    공유하던 문제이고([[ADR-099]]), RN 에서는 스크롤이 화면과 함께 죽어 계승할 오프셋이 없다.
// ② `?openPicker=1` **쿼리 → 라우트 파라미터**(`route.params.openPicker`). URL 이 없어 "새로고침·
//    뒤로가기마다 피커가 다시 열린다"는 웹의 걱정은 사라지지만, 파라미터는 스택에 남아 **탭을
//    떠났다 돌아오면 그대로 살아 있다.** 그래서 지우는 일은 그대로 필요하고, `setSearchParams` 대신
//    `setParams` 다(설정의 안내 마디가 밟은 자리). **보내는 쪽은 아직 없다** — 그 링크는 보스 수익
//    화면([[ADR-068]] 결정 4)에 있고 step 7 이 온다.
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
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReducedMotion } from 'react-native-reanimated'

import type { BossContent, BossDifficulty, CharacterPickerEntry } from '@core/types'
import { partySizeKey, useBossSchedulerStore, type PartyFilter } from '@core/features/boss-scheduler/store'
import { formatSyncedAt } from '@core/features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '@core/features/schedule-sync/use-sync-error-toast'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import { getCharacterPickerRoster, toScheduleSyncError } from '@core/features/schedule-sync/schedule-sync'
import type { ScheduleSyncError } from '@core/features/schedule-sync/schedule-sync'
import { useToastStore } from '@core/features/toast/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { getBossPortraitCrop, getBossPortraitUrl, type BossPortraitCrop } from '@core/lib/boss-icons'
import {
  getSupportedDifficulties,
  matchBossContent,
  selectDisplayBosses,
  type MatchedBoss,
} from '@core/lib/boss-matching'
import { getMaxPartySize } from '@core/lib/boss-crystal-prices'
import { mergeManualBossList } from '@core/lib/manual-boss-merge'
import { isChallengersWorld } from '@core/lib/world-emblem'

import { Badge } from '../../components/atoms/Badge/Badge'
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { CharacterSelectDropdown } from '../../components/molecules/CharacterSelectDropdown/CharacterSelectDropdown'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { MediaCard, MediaCardArt } from '../../components/molecules/MediaCardArt/MediaCardArt'
import { CharacterTrackingPicker } from '../../components/organisms/CharacterTrackingPicker/CharacterTrackingPicker'
import { PartySizeModal } from '../../components/organisms/PartySizeModal/PartySizeModal'
import { ProgressModal } from '../../components/organisms/ProgressModal/ProgressModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../lib/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { RefreshCwIcon, SlidersHorizontalIcon, SwordsIcon, UsersIcon } from '../../lib/icons'
import { MEDIA_TEXT_SHADOW_STYLE } from '../../lib/text-styles'
import { useThemeAppearance } from '../../theme/context'
import type { TabParamList } from '../../navigation/routes'
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
    characters,
    error,
    trackedOcids,
    selectedOcid,
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    saveTrackedOcids,
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
  const route = useRoute<RouteProp<TabParamList, 'Boss'>>()
  const insets = useSafeAreaInsets()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(() => route.params?.openPicker === true)
  // [[ADR-053]] 결정 3: 후보 목록 조회의 로딩·실패는 조회를 소유한 화면이 관리해 피커에 내려준다.
  // 초기값은 "마운트 직후 조회가 시작되는가"(= 파라미터로 이미 열려 있는가)와 같다.
  const [isRosterLoading, setIsRosterLoading] = useState(isPickerOpen)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)
  // [[ADR-062]]: 재조회 트리거. 피커를 여는 것과 재시도가 같은 초기화(reloadRoster)를 공유하고,
  // 이 값이 바뀌면 아래 조회 effect가 다시 돈다.
  const [rosterReloadNonce, setRosterReloadNonce] = useState(0)
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)
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

  // 보스 수익 화면의 "캐릭터 선택하러 가기"(파일 머리 ②)로 진입했을 때만 파라미터를 지운다 —
  // 웹의 `?openPicker=1` 정리와 같은 자리다. 안 지우면 탭을 떠났다 돌아올 때마다 피커가 다시 열린다.
  useEffect(() => {
    if (route.params?.openPicker !== true) return
    navigation.setParams({ openPicker: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // [[ADR-015]]: 후보 목록에 이미지·access_flag가 필요해져 피커를 열 때만 조회한다
  // (마운트 시 매번 호출하면 화면에 들어오기만 해도 캐릭터 수만큼 병렬 호출이 발생함).
  // [[ADR-016]]: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(전체를 기다리지 않음).
  // [[ADR-017]] 결정 6: character/list 응답을 기다리는 동안에도 character-basic-cache에 이미
  // 있는 캐릭터(추적 여부 무관)는 즉시 먼저 보여줘, 피커를 열 때마다 짧게 비어 보이던 문제를
  // 완화한다.
  // [[ADR-053]] 결정 3: 조회 결과(Promise)를 버리지 않고 로딩·실패 상태로 남긴다 — 401/429는 reject로
  // 나오므로 finally에서 반드시 로딩을 해제해야 스피너가 영구히 걸리지 않는다. roster는 재조회
  // 시작 시에도 비우지 않는다(캐시로 보여주던 목록을 지우면 [[ADR-016]] 캐시 우선 표시가 무력화된다).
  useEffect(() => {
    if (!isPickerOpen) return
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    })
      .catch((error: unknown) => {
        if (!cancelled) setRosterError(toScheduleSyncError(error))
      })
      .finally(() => {
        if (!cancelled) setIsRosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isPickerOpen, rosterReloadNonce])

  // [[ADR-115]] 결정 7: 감지 지점은 동기화만이 아니다 — 피커 로스터가 맞는 401도 같은 키 무효화라
  // 같은 진입점을 부른다(동기화 쪽 위임은 useScheduleSyncErrorToast 안에 있다).
  // [[ADR-116]] 결정 1: 429도 같은 진입점을 탄다 — 이름만 바뀌었을 뿐 이 자리는 그대로다.
  useApiKeyNotice(rosterError)

  // [[ADR-101]] 결정 1: `null` 은 "0명"이 아니라 **"저장소를 아직 안 읽었다"** 다. 둘을 `||` 로 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다(실기기 2026-08-06 — "표시할 캐릭터가
  // 없습니다"가 목록보다 먼저 한 프레임 스쳤다). 빈 상태는 읽고 0명임을 **확인한 뒤에만** 그린다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

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

  // [[ADR-035]] 결정 3·6·12: 수동 모드에서는 게임 등록 여부가 아니라 사용자가 앱에서 관리하는
  // 멤버십(manualTrackedContent)으로 표시 목록을 결정하고, 완료 여부는 동기화 결과에서 즉석
  // 조회한다(mergeManualBossList). synced는 store의 auto 목록(MatchedBoss)에서 BossContent로
  // 되돌려 넘긴다 — MatchedBoss는 BossContent의 모든 필드를 갖고 있어 손실이 없다.
  const manualBossItems =
    selected !== null
      ? (manualTrackedByOcid?.[selected.ocid] ?? []).filter((item) => item.kind === 'boss')
      : []

  const syncedBossContents: BossContent[] =
    selected === null
      ? []
      : [...selected.weeklyBosses, ...selected.monthlyBosses].map((boss) => ({
          name: boss.apiName,
          difficulty: boss.difficulty,
          cycle: boss.cycle,
          isRegistered: boss.isRegistered,
          isComplete: boss.isComplete,
          ownComplete: boss.ownComplete,
        }))

  const manualBosses =
    mode === 'manual' ? mergeManualBossList(manualBossItems, syncedBossContents).map(matchBossContent) : []

  // 카드로 표시할 목록 — auto 모드는 등록된 보스뿐 아니라 미등록이어도 완료된 보스를 포함하고
  // ([[ADR-031]] 결정 5), manual 모드는 selectDisplayBosses(등록 우선) 대신 추적 멤버십 그대로 보여준다.
  const displayedWeeklyBosses =
    selected === null
      ? []
      : mode === 'manual'
        ? manualBosses.filter((boss) => boss.cycle === 'weekly')
        : selectDisplayBosses(selected.weeklyBosses)
  const displayedMonthlyBosses =
    selected === null
      ? []
      : mode === 'manual'
        ? manualBosses.filter((boss) => boss.cycle === 'monthly')
        : selectDisplayBosses(selected.monthlyBosses)

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

  async function handleSaveTracking(ocids: string[]): Promise<void> {
    setSaveProgress({ completed: 0, total: ocids.length })
    // 저장이 실패해도(스토어가 처리 못한 예외 등) 진행률 모달은 항상 닫는다 — 안 그러면 모달이 멈춘다.
    try {
      await saveTrackedOcids(ocids, (completed, total) => setSaveProgress({ completed, total }))
    } finally {
      setSaveProgress(null)
      setIsPickerOpen(false)
    }
  }

  // [[ADR-053]] 결정 3: 피커를 여는 유일한 경로 — 여는 순간 로딩·실패를 초기화한다(닫았다 다시 열면
  // 위 useEffect가 재조회하므로 직전 실패가 남아 있으면 안 된다). 초기화를 effect 본문이 아니라
  // 이 이벤트 핸들러에 두는 이유는 effect 본문의 동기 setState가 cascading render를 만들기 때문.
  // [[ADR-062]] 트레이드오프: 여는 경로와 재시도가 같은 초기화를 쓴다 — 재조회 로직을 한 곳으로 모은다.
  function reloadRoster(): void {
    setIsRosterLoading(true)
    setRosterError(null)
    setRosterReloadNonce((nonce) => nonce + 1)
  }

  function openPicker(): void {
    setIsPickerOpen(true)
    reloadRoster()
  }

  const characterManageButton = (
    <Pressable role="button" onPress={openPicker}>
      <Text className="text-sm font-medium text-text-muted">캐릭터 관리</Text>
    </Pressable>
  )

  // [[ADR-035]] 결정 18: 추적 편집(수동)과 파티원 수 설정을 관리 페이지 하나로 통합 — 두 모드 공통
  // 진입점이라 헤더는 항상 [보스 관리 · 캐릭터 관리] 2버튼이다(기존 "파티 관리" 모달 대체).
  const bossManageButton = (
    <Pressable role="button" onPress={() => navigation.navigate('BossManage')}>
      <Text className="text-sm font-medium text-text-muted">보스 관리</Text>
    </Pressable>
  )

  const trackingPicker = isPickerOpen && (
    <CharacterTrackingPicker
      entries={roster}
      trackedOcids={trackedOcids ?? []}
      isLoading={isRosterLoading}
      loadError={rosterError}
      onSave={handleSaveTracking}
      onClose={() => setIsPickerOpen(false)}
      onRetry={reloadRoster}
    />
  )

  // 저장 중에는 캐릭터 관리 모달 위에 진행률 모달을 띄운다(완료 시 둘 다 닫힌다).
  const trackingModals = (
    <>
      {trackingPicker}
      {saveProgress !== null && (
        <ProgressModal
          message="캐릭터 정보를 저장하고 있어요"
          completed={saveProgress.completed}
          total={saveProgress.total}
        />
      )}
    </>
  )

  // [[ADR-060]]: 빈 상태 문구는 탭(주간/월간)과 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다 —
  // 자동 모드가 지시하는 곳("게임에서 등록")은 앱 밖이라 데려다줄 수 없다.
  function bossEmptyProps(tab: 'weekly' | 'monthly'): React.ComponentProps<typeof EmptyState> {
    const label = tab === 'weekly' ? '주간' : '월간'
    if (mode === 'manual') {
      return {
        icon: SwordsIcon,
        title: `추적할 ${label} 보스가 없습니다`,
        description: `보스 관리에서 이번 ${tab === 'weekly' ? '주' : '달'}에 잡을 보스를 골라주세요`,
        action: { label: '보스 관리', onClick: () => navigation.navigate('BossManage') },
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
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-text">보스 스케줄러</Text>
          {characterManageButton}
        </View>

        <View className="flex-1 items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="표시할 캐릭터가 없습니다"
            description="캐릭터를 선택하면 주간·월간 보스 스케줄을 확인할 수 있습니다"
            action={{ label: '캐릭터 선택하기', onClick: openPicker }}
          />
        </View>

        {trackingModals}
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
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-text">보스 스케줄러</Text>
              <View className="flex-row items-center gap-4">
                {selected !== null && bossManageButton}
                {characterManageButton}
              </View>
            </View>

            <View className="gap-1">
              <View className="flex-row items-center gap-3">
                {characters.length > 0 && selected !== null && (
                  <CharacterSelectDropdown
                    characters={characters}
                    selectedOcid={selected.ocid}
                    onSelect={(ocid) => {
                      void selectCharacter(ocid)
                    }}
                  />
                )}

                <View className="ml-auto shrink-0 flex-row items-center gap-2">
                  <Text className="text-sm text-text-muted">
                    {status === 'loading' ? '조회 중...' : selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
                  </Text>
                  <Pressable
                    role="button"
                    aria-label="새로고침"
                    onPress={() => refresh(trackedOcids ?? [])}
                    className="p-2"
                  >
                    <AnimatedView
                      testID="refresh-icon"
                      style={status === 'loading' && !reduceMotion ? SPIN_ANIMATION : undefined}
                    >
                      <RefreshCwIcon className="h-4 w-4 text-primary-ink" strokeWidth={2} aria-hidden />
                    </AnimatedView>
                  </Pressable>
                </View>
              </View>
            </View>

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

      {trackingModals}

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
