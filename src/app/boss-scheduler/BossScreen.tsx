// 보스 스케줄러 — 주간/월간 보스 진행 상태(`docs/features/boss-scheduler.md`).
//
// **이 화면에 걸린 ADR 이 스물여섯이다** — 저장소에서 `BossProfitScreen` 다음으로 무겁다. 대부분은
// 화면에 안 보이는 판단이라(완료 승격 · 시즌 보스 판정 · 실패의 목적지 · 빈 상태의 판정 시점) 아래
// 주석이 그 자리를 지목한다. 목록은 `docs/migration/parity-inventory.md` §2.4.
//
// ══ RN 으로 옮기며 **사라진** 것 넷 — 컨텐츠 스케줄러와 같다 ═══════════════════════════
//
// ① **당김을 손으로 만들던 제스처 훅과 커스텀 인디케이터**([[ADR-130]] 결정 1). 지금은
//    `RefreshControl` 이 맡는다. **컨텐츠 스케줄러와 같은 배선이어야 한다** — 두 탭이 같은 제스처에
//    다르게 반응하면 그 자체가 회귀다. [[ADR-072]] 결정 2·10 은 글자 그대로 지켜진다.
// ② **목록을 손가락 따라 내리던 `transform`**([[ADR-130]] 결정 1) — 그 일을 OS 가 한다.
// ③ **`useScreenStackStore` 의 깊이로 당김을 끄던 배선**([[ADR-120]] 결정 10). 하위 페이지는 루트
//    스택에 **덮여** 올라오므로 아래 화면의 스크롤 뷰에 손가락이 닿지 않는다.
// ④ **`<Outlet />`**([[ADR-077]] 언마운트 금지). 관리 페이지는 형제 라우트가 아니라 **형제 탭**이라
//    ([[ADR-145]] 결정 1 — 그전에는 루트 스택 push 였다) 이 화면이 트리에 그대로 남는다 — 계약을
//    코드가 아니라 내비게이터가 지킨다.
//
// ══ 갈린 것 다섯 ═══════════════════════════════════════════════════════════════════
//
// ① `useNavigate('/boss/manage')` → `openTab('BossManage')`(같은 층의 형제, [[ADR-167]] 결정 3).
//    **[[ADR-098]] 결정 1(이동 전에 스크롤을 0으로)은 함께 사라진다** — 그 처방이 풀던 것은 네 탭이
//    문서 스크롤 하나를 공유하던 문제이고([[ADR-099]]), RN 에서는 스크롤이 화면과 함께 죽어 계승할
//    오프셋이 없다. **목적지가 push 가 아니라 형제 탭인 것은 [[ADR-145]] 결정 1 이다** — 그래서
//    이 화면의 헤더에는 그리로 가는 버튼이 아예 없고, 남은 호출부는 빈 상태 CTA 하나다.
// ② **캐릭터 관리 피커가 이 화면에 없다**([[ADR-140]]). 헤더 버튼도, 그것이 열던 모달도, 그 모달을
//    먹여 살리던 로스터 조회([[ADR-015]]·[[ADR-016]]·[[ADR-053]]·[[ADR-062]])도, 웹의 `?openPicker=1`
//    을 받던 라우트 파라미터도 **설정 화면으로 통째로 옮겨갔다** — 추적 목록은 [[ADR-042]] 이후 앱
//    전역 하나인데 그것을 고르는 자리만 다섯이었다. 남은 흔적은 빈 상태 CTA 하나이고, 그것도 모달이
//    아니라 **설정 탭을 피커가 열린 채로** 연다.
// ③ **카드 눌림 피드백이 절반만 온다**([[ADR-121]] 결정 1 — 이 카드의 어포던스가 그것뿐이다).
//    `active:scale-[.985]` 는 NativeWind 가 그대로 낸다(실측). `active:brightness-110` 은 **조용히
//    사라진다** — NativeWind 가 `brightness-*` 를 네이티브 `filter` 로 내보내지 않는다. 탈출구인
//    `style={({pressed}) => …}` 함수도 못 쓴다: NativeWind 가 `Pressable` 의 style **함수를 통째로
//    삼킨다**(className 이 없어도 그렇다 — 실측). 남는 길은 `onPressIn/Out` 상태를 카드마다 두는
//    것뿐인데, 눌림을 알리는 일은 축소가 이미 하므로 그 값을 치르지 않는다(육안 대조 목록).
// ④ `<button>` → `Pressable` + `Text`, `hover:` 는 사라진다(RN 에 호버가 없다).
// ⑤ `animate-spin` → Reanimated CSS 애니메이션(`lib/animation.ts`). step 4 가 화면 안 상수로 두며
//    *"보스 스케줄러가 붙는 step 5 에서 둘이 된다"* 고 적어 둔 자리라, 여기서 `lib/` 로 올렸다
//    ([[ADR-094]] 결정 1).
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
  /** 요구 레벨 미달 — 「완료」 자리를 «진행 불가» 로 대체한다([[ADR-162]] 결정 3). */
  isBlocked?: boolean
  onEdit: () => void
}): React.JSX.Element {
  const { boss, partySize } = props
  const portraitUrl = getBossPortraitUrl(boss.portraitSlug)
  const crop = props.crop ?? getBossPortraitCrop(boss.portraitSlug)
  const bossName = boss.matchedBossName ?? boss.apiName

  // 카드 배경/보더/보스명 텍스트는 페이지 표면이 아니라 일러스트 위 배색을 따른다 — bleed·페이드·
  // text-shadow가 어두운 배경을 전제로 튜닝됐기 때문에 라이트 테마에서 페이지 토큰(bg-surface 등)을
  // 쓰면 대비가 깨진다. `IllustratedCard` 가 카드 안쪽의 기준 표면을 media-surface로 바꾸므로
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
            {/* [[ADR-162]] 결정 3 — 진행 불가면 「완료」 자리를 대체한다. 진행할 수 없는 보스의
                완료 여부는 게임이 준 스냅샷이지 이 캐릭터가 잡을 수 있다는 뜻이 아니다. */}
            {/* [[ADR-187]] 결정 2 — 주간 12마리를 채우면 남은 미처치 보스는 「마감」이다. **완료로
                칠하지 않는다**: 안 잡은 보스를 완료로 두면 그 거짓이 보스 수익의 결정석 금액이
                된다. 배색은 `Badge` 의 `muted` 톤을 그대로 쓴다(실패도 경고도 아니고 «이번 주엔
                차례가 없다» 는 사실이라 눌린 회색이다 — 새 색을 만들지 않는다).
                우선순위는 「진행 불가」 > 「마감」 > 「완료」 — 요구 레벨에 못 미치는 보스는
                한도와 무관하게 애초에 못 잡는다. */}
            {props.isBlocked === true ? (
              <Badge variant="muted" fixed className="shrink-0">진행 불가</Badge>
            ) : boss.isWeeklyLimitClosed ? (
              // **「완료」와 같은 상자다**(사용자 지정) — 자리를 대신하는 배지라 크기가 다르면 같은
              // 자리에서 배지가 커졌다 작아졌다 하며 카드 오른쪽 끝이 흔들린다. 갈리는 것은 색뿐이고,
              // 그 색은 `Badge` 의 `muted` 톤이다(실패도 경고도 아닌 «차례가 아니다» — 눌린 회색).
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
    // [[ADR-121]]: 카드 탭 모달이 쓰는 두 액션. 파티 인원은 두 모드 공통이고, 난이도 교체는 수동
    // 모드에서만 멤버십을 바꾼다.
    setPartySize,
    setManualBossDifficulty,
    // [[ADR-096]] 결정 1: 탭과 두 필터는 스토어 소유다 — 이 화면이 언마운트돼도 살아남고, 관리
    // 페이지가 같은 탭 값을 읽어 보던 탭 그대로 열린다.
    // **필터는 하나다**([[ADR-164]] 결정 5 — [[ADR-019]] 결정 6 정정). 목록이 하나가 되면서
    // «두 축이 서로 독립» 이라는 문장이 뜻을 잃었다(독립할 상대가 없다).
    partyFilter,
    setPartyFilter,
  } = useBossSchedulerStore()
  // 선택은 화면·스토어가 아니라 **여기 한 벌**이다([[ADR-159]] 결정 1).
  const { selectedOcid, select } = useCharacterSelectionStore()
  // **당김이 시작한 회차에만** 인디케이터가 돈다([[ADR-160]] 결정 1). 헤더 버튼·자동 조회는 같은
  // 재조회를 부르지만 인디케이터는 안 연다 — 버튼은 자기 스피너와 «조회 중...» 을 이미 갖고 있고
  // ([[ADR-141]] 결정 1), 자동 조회는 원래 조용해야 하는 것이다.
  const pull = usePullRefresh(() => refresh(trackedOcids ?? []))
  const { mode } = useTrackingModeStore()
  const openTab = useOpenTab()
  const topSafeAreaPx = useTopSafeAreaPx()
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

  // 화면 넷이 **같은 규칙**으로 고른다([[ADR-159]] 결정 3) — 선택만 합치고 폴백을 화면마다 두면
  // «공유했는데 화면마다 다른 캐릭터» 가 다시 생긴다.
  const selected = resolveSelectedCharacter(selectedOcid, characters)

  // [[ADR-083]] 결정 1: 캐릭터별 실패도 인라인 문단이 아니라 토스트다. syncSchedules는 캐릭터 단위
  // 실패를 던지지 않고 결과에 실어 반환하므로(401/429는 나머지 캐릭터까지 같은 에러로 채운다)
  // 실패의 대부분이 위의 전역 error가 아니라 이 값으로 온다 — 두 훅이 동시에 울릴 조합은 없다
  // (전역 error가 채워지는 경로에서는 characters가 캐시 뷰로 교체되고 그 뷰의 error는 null이다).
  useScheduleSyncErrorToast(selected?.error ?? null, { onRetry: () => refresh(trackedOcids ?? []) })

  // 카드로 표시할 목록 — [[ADR-035]] 수동 모드 멤버십과 [[ADR-031]] 결정 5(미등록이어도 완료면
  // 포함)가 그 안에 있다. **이 화면의 지역 함수였던 것을 코어로 꺼냈다**([[ADR-147]] 결정 8) —
  // today 의 「캐릭터별 남은 스케줄」이 세는 «남은 보스» 가 이 화면이 보여 주는 것과 한 글자도
  // 달라선 안 되기 때문이다. 이유·규칙·«캐릭터를 인자로 받는» 근거는 `displayed-bosses.ts` 파일 머리.
  //
  // **순서는 여기서 정하지 않는다**([[ADR-164]] 결정 1) — `displayedBossSections` 가 월간을 위에
  // 두고, 이 화면은 받은 순서대로 그린다. 화면이 다시 정렬하면 그 결정이 두 곳이 된다.
  const sections =
    selected === null ? [] : displayedBossSections(selected, mode, manualTrackedByOcid)

  // [[ADR-142]] 정정 1: 링은 **주간 하나**다(온전한 원). 월간은 종류가 하나뿐이라 «몇 개 중 몇 개»
  // 가 뜻을 갖지 못한다 — 표현 방법은 따로 정한다(사용자 지시, 2026-08-16).
  // **솔로/파티 필터는 안 탄다**(결정 4) — 필터는 «지금 보고 싶은 것» 이지 진행이 아니다.
  //
  // **요구 레벨 미달은 분모에서 빠진다**([[ADR-162]] 결정 1·2) — 남겨 두면 그 캐릭터의 링이
  // 100%에 절대 도달하지 못한다. 컨텐츠 진행률과 **같은 판정 함수**를 본다.
  //
  // **마감도 «다 한 것» 으로 센다**([[ADR-187]] 결정 2 후속, 사용자 지정) — 주간 한도를 채웠으면
  // 그 보스는 이번 주에 더 할 수 없으므로, 분자에서 빼면 링이 영영 100%에 못 닿고 «아직 남았다» 는
  // 거짓을 말한다(레벨 미달을 분모에서 뺀 것과 같은 이유, 다른 자리). **분모에서 빼지 않는 것**이
  // 레벨 미달과 갈리는 지점이다: 저쪽은 «이 캐릭터의 일이 아니다» 이고 이쪽은 «이번 주 일은 끝났다»
  // 라, 12마리를 추적했으면 링은 `12/12` 로 읽혀야 한다.
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
  // 원소 타입을 안 좁힌다 — 거르기만 하는 함수라 `DisplayedBoss` 가 들어오면 그대로 나가야 한다.
  function filterByPartySize<T extends MatchedBoss>(bosses: T[], ocid: string, filter: PartyFilter): T[] {
    if (filter === 'all') return bosses
    return bosses.filter((boss) => {
      const size = getPartySize(ocid, boss) ?? 1
      return filter === 'party' ? size >= 2 : size <= 1
    })
  }

  // 필터를 건 뒤에야 «비었다» 가 성립한다 — 그래서 빈 무리를 걷는 것이 여기다([[ADR-164]] 결정 6).
  // `displayedBossSections` 가 빈 무리도 자리를 남겨 주는 이유가 이 순서 때문이다.
  const filteredSections =
    selected === null
      ? []
      : sections.map((section) => ({
          ...section,
          bosses: filterByPartySize(section.bosses, selected.ocid, partyFilter),
        }))
  // 「주간」 헤더가 싣는 배지 — 이 값들은 **표시 목록과 무관하다**. `weeklyBossClearCount` 는
  // **앱이 센** 이번 주 처치 수이고(`countClearedWeeklyBosses`, [[ADR-031]] 결정 1 — 넥슨의
  // `weekly_boss_clear_count` 는 타입에만 있고 제품 코드는 안 쓴다. 2026-08-30 [[ADR-187]] 정정:
  // 이 자리에 «게임이 세는 수» 라고 적혀 있었다), 시즌 완료 여부도 등록과 무관하다
  // ([[ADR-031]] 결정 3 — 그래서 미등록·미완료 시즌 보스는 카드로 안 서면서 배지만 뜬다).
  const weeklySeasonState =
    seasonBosses.length === 0 ? null : isSeasonBossComplete ? ('complete' as const) : ('incomplete' as const)
  const hasWeeklyBadges =
    weeklySeasonState !== null ||
    (selected?.weeklyBossClearCount != null && selected.weeklyBossClearLimitCount != null)

  // 빈 무리의 헤더는 걷는다 — 이름만 남으면 «여기 뭔가 있었다» 로 읽힌다([[ADR-164]] 결정 6).
  // **단 배지를 싣고 있으면 남긴다.** 탭 시절 그 배지들은 목록이 비어도 떠 있었고(탭 줄에 있었다),
  // 무리가 비었다는 이유로 지우면 «이번 주 3마리 잡았다» 를 화면이 말할 자리가 아예 없어진다.
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
    openTab('Settings', { openPicker: true })
  }

  // [[ADR-035]] 결정 18 이 만든 헤더 진입점("보스 관리")은 **여기 없다**([[ADR-145]] 결정 1) —
  // 그 화면이 스케줄 그룹의 하위 탭이 되면서 진입 자리를 하단바가 가져갔다. [[ADR-140]] 이 걷은
  // "캐릭터 관리"에 이어 제목 줄의 두 번째이자 마지막 버튼이 사라진 것이라, 이제 그 줄에서 폭을
  // 다투는 상대가 없다([[ADR-141]] 결정 3의 `shrink-0` 짝이 하나만 남는다).
  //
  // 남는 것은 빈 상태 CTA 하나이고, 그것도 push 가 아니라 **같은 층의 형제**로 보낸다
  // ([[ADR-167]] 결정 3 — 보스 관리는 이 화면과 같은 스케줄러 단에 산다).
  function goToBossManage(): void {
    openTab('BossManage')
  }

  // [[ADR-060]]: 빈 상태 문구는 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다 — 자동 모드가
  // 지시하는 곳("게임에서 등록")은 앱 밖이라 데려다줄 수 없다.
  //
  // **주기별로 나누던 축은 사라졌다**([[ADR-164]] 결정 6 — [[ADR-060]] 정정). 목록이 하나라
  // 판정도 하나이고, 무리별로 물으면 검마를 안 잡는 캐릭터마다 «추적할 월간 보스가 없습니다» 가
  // 뜬다 — 그것은 빈 상태가 아니라 **그냥 그 캐릭터의 목록**이다.
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

  // 보스가 0건인 빈 상태와 달리 "필터가 가린 상태"라 CTA는 필터를 되돌린다([[ADR-060]] 결정 3).
  function filterEmptyProps(): React.ComponentProps<typeof EmptyState> {
    return {
      icon: SlidersHorizontalIcon,
      title: '이 조건에 해당하는 보스가 없습니다',
      description: '솔로·파티 필터를 해제하면 전체 보스를 볼 수 있습니다',
      action: { label: '필터 초기화', onClick: () => setPartyFilter('all') },
    }
  }

  if (isEmpty) {
    // 헤더 셸을 쓰지 않는 가지라(제목 줄이 목록 없이 혼자 선다) 상단 안전영역을 여기서 먹는다 —
    // 웹의 `min-h-[calc(100dvh …)]` 자리는 `flex-1` 이다(탭 상자가 이미 탭바를 뺀 크기다).
    return (
      <View testID="screen-Boss" className="flex-1 p-4" style={{ paddingTop: topSafeAreaPx }}>
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
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={definition.primaryInk}
            colors={[definition.primaryInk]}
            progressBackgroundColor={definition.surface}
          />
        }
        header={
          // 제목~솔로/파티 필터도 목록과 **함께 스크롤된다**([[ADR-131]]) — 헤더는 `ScreenScroll`
          // 의 첫 자식이다. `fixed` 도 spacer 도 없다: [[ADR-098]] 결정 2 가 웹에서 풀던 문제가
          // 구조적으로 없다(`PageHeader` 파일 머리).
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
                  void select(ocid)
                }}
              />
            )}

            {/* [[ADR-016]]: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
                셸 승계 카드는 보여줄 데이터가 아예 없을 때만 그린다([[ADR-061]] 결정 2). */}
            {(status === 'idle' || status === 'loading') && characters.length === 0 && (
              <LoadingState size="page" message="불러오고 있어요" />
            )}

            {/* [[ADR-164]] 결정 4: **주간/월간 탭이 여기 있었다.** 목록이 하나가 되면서 걷혔고,
                탭에만 매달려 있던 `n/12`·`season` 배지는 「주간」 섹션 헤더로 내려갔다(결정 3) —
                그 수치가 어느 무리의 것인지 이제 헤더가 말한다. 남는 줄은 필터 하나뿐이다. */}
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
            {/* 빈 상태 둘은 **목록 하나**를 보고 판정한다([[ADR-164]] 결정 6) — 무리별로 물으면
                검마를 안 잡는 캐릭터마다 «추적할 월간 보스가 없습니다» 가 뜬다. */}
            {displayedCount === 0 && (mode === 'manual' || !selected.isStale) && (
              <EmptyState {...bossEmptyProps()} />
            )}

            {displayedCount > 0 && filteredCount === 0 && <EmptyState {...filterEmptyProps()} />}

            {/* 순서는 `displayedBossSections` 것이고(결정 1), **비어 있는 무리는 이미 걷혔다**
                (`visibleSections`) — 헤더만 남아 «여기 뭔가 있었다» 로 읽히지 않게 한다(결정 6). */}
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
