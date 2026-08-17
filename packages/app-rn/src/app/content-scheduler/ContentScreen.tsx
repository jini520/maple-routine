// 컨텐츠 스케줄러 — 일간/주간 콘텐츠 진행 상태(`docs/features/content-scheduler.md`).
//
// **이 화면에 걸린 ADR 이 스물하나다.** 대부분은 화면에 안 보이는 판단이라(캐시 우선 표시 · 실패의
// 목적지 · 빈 상태의 판정 시점) 아래 주석이 그 자리를 지목한다. 목록은
// `docs/migration/parity-inventory.md` §2.3.
//
// ══ RN 으로 옮기며 **사라진** 것 넷 — 전부 구조가 대신한다 ═══════════════════════════
//
// ① **`usePullToRefresh` 훅과 `PullToRefreshIndicator`**([[ADR-130]] 결정 1). 당김을
//    `RefreshControl` 이 맡는다 — 안드로이드에는 당김 거리 신호 자체가 없어 커스텀 마크를 고르면
//    제스처 계층을 새로 만들어야 했다. [[ADR-072]] 결정 2(당김 = 헤더 버튼과 **같은 재조회**)와
//    결정 10(버튼은 그대로 남는다)은 글자 그대로 지켜진다. **[[ADR-073]] 결정 1 은 아니다** —
//    *"헤더는 제자리, 목록만 내려간다"* 는 헤더가 스크롤 뷰의 형제일 때의 그림이었고, [[ADR-131]]
//    이 헤더를 스크롤 뷰 **안**으로 넣으면서 iOS 에서는 러버밴드에 헤더도 함께 내려간다(안드로이드
//    는 콘텐츠를 안 움직이고 글로우만 그려 원래부터 무관하다). **전제가 사라진 것이지 회귀가
//    아니다.** 다만 이것은 구조에서 따라 나온 결론이고 **실기기로 확인한 것은 아니다** — 육안
//    대조 때 눈에 담을 자리다.
// ② **`resolveContentOffsetPx` 로 목록을 내리던 `transform`**([[ADR-073]] 결정 6). 목록을 내리는
//    일을 OS 가 한다.
// ③ **`useScreenStackStore` 의 깊이로 당김을 끄던 배선**([[ADR-120]] 결정 10). 하위 페이지는 루트
//    스택에 **덮여** 올라오므로 아래 화면의 스크롤 뷰에 손가락이 닿지 않는다.
// ④ **`<Outlet />`**([[ADR-077]] 언마운트 금지). 관리 페이지는 형제 라우트가 아니라 루트 스택
//    push 라 이 화면이 트리에 그대로 남는다 — 계약을 코드가 아니라 내비게이터가 지킨다.
//
// ══ 갈린 것 넷 ═════════════════════════════════════════════════════════════════════
//
// ① `useNavigate('/content/manage')` → `navigation.navigate('ContentManage')`.
//    **[[ADR-098]] 결정 1(이동 전에 스크롤을 0으로)은 함께 사라진다** — 그 처방이 풀던 것은 네 탭이
//    문서 스크롤 하나를 공유하던 문제이고([[ADR-099]]), RN 에서는 스크롤이 화면과 함께 죽어
//    계승할 오프셋이 없다(`ScreenScroll` 파일 머리).
// ② `<button>` → `Pressable` + `Text`, `hover:` 는 사라진다(RN 에 호버가 없다).
// ③ `animate-spin` → Reanimated CSS 애니메이션(`lib/animation.ts` 의 `SPIN_ANIMATION`).
//    NativeWind 에 그 클래스가 없고, **없는 클래스는 에러가 아니라 안 도는 아이콘**이라 값으로 준다.
//    step 5 에서 보스 스케줄러가 두 번째 호출부가 되며 화면 안 상수에서 `lib/` 로 올라갔다.
// ④ **캐릭터 관리 피커가 이 화면에 없다**([[ADR-140]]). 헤더 버튼도, 그것이 열던 모달도, 그
//    모달을 먹여 살리던 로스터 조회([[ADR-015]]·[[ADR-016]]·[[ADR-053]]·[[ADR-062]])도 **설정
//    화면으로 통째로 옮겨갔다** — 추적 목록은 [[ADR-042]] 이후 앱 전역 하나인데 그것을 고르는 자리만
//    다섯이었다. 남은 흔적은 빈 상태 CTA 하나이고, 그것도 모달이 아니라 **설정 탭을 연다**.
//    그래서 웹이 «모달을 셸 바깥 형제로 둔다»(`z-50` 이 셸의 스태킹 컨텍스트에 갇히는 것을 피한다)
//    고 정한 자리가 이 파일에서 사라졌다.
import { useEffect } from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReducedMotion } from 'react-native-reanimated'

import type { DailyContent, WeeklyContent } from '@core/types'
import { useContentSchedulerStore, type ContentCharacterView } from '@core/features/content-scheduler/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { formatSyncedAt } from '@core/features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '@core/features/schedule-sync/use-sync-error-toast'
import { mergeManualContentList, orderContentsByTemplate } from '@core/lib/manual-content-merge'
import { CONTENT_TEMPLATE } from '@core/lib/scheduler-content-template'
import { categorizeContentEntries, WEEKLY_CATEGORY_ORDER } from '@core/lib/content-category'

import { dailyContentProgress, weeklyContentProgress } from './content-completion'

import { CharacterRail, type CharacterRailEntry } from '../../components/molecules/CharacterRail/CharacterRail'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../lib/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { ListChecksIcon, RefreshCwIcon } from '../../lib/icons'
import { orderByTracked } from '../../lib/tracked-order'
import { useThemeAppearance } from '../../theme/context'
import { useScreenNavigation } from '../use-screen-navigation'
import { renderDailyContentCard } from './DailyContentCards'
import { renderWeeklyContentCard } from './WeeklyContentCards'

// ADR-035 결정 20: 수동 모드 표시 순서를 컨텐츠 관리 페이지와 동일하게 고정하려고, 템플릿을
// 관리 페이지와 같은 categorizeContentEntries 평탄화 순서로 미리 정렬해 mergeManualContentList에
// 넘긴다(일간은 첫 등장 순서, 주간은 WEEKLY_CATEGORY_ORDER). 캐릭터 무관 상수라 모듈 레벨에서 1회 계산.
const ORDERED_DAILY_TEMPLATE = categorizeContentEntries(CONTENT_TEMPLATE.daily).flatMap((group) =>
  group.items.map((item) => item.entry),
)
const ORDERED_WEEKLY_TEMPLATE = categorizeContentEntries(CONTENT_TEMPLATE.weekly, WEEKLY_CATEGORY_ORDER).flatMap(
  (group) => group.items.map((item) => item.entry),
)

export function ContentScreen(): React.JSX.Element {
  const {
    status,
    characters: storeCharacters,
    error,
    trackedOcids,
    selectedOcid,
    manualTrackedByOcid,
    loadTrackedOcids,
    refresh,
    selectCharacter,
    // ADR-096 결정 1: 탭은 스토어 소유다 — 이 화면이 언마운트돼도 살아남고, 관리 페이지가
    // 같은 값을 읽어 보던 탭 그대로 열린다.
    activeTab,
    setActiveTab,
  } = useContentSchedulerStore()
  const { mode } = useTrackingModeStore()
  const navigation = useScreenNavigation()
  const insets = useSafeAreaInsets()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()
  // ADR-063: 동기화 전체 실패는 인라인 문단이 아니라 토스트로 알린다 — 지속 상태("n분 전")는
  // 새로고침 옆 표기가 이미 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-101 결정 1: `null` 은 "0명"이 아니라 **"저장소를 아직 안 읽었다"** 다. 둘을 `||` 로 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다 — 빈 상태는 읽고 확인한 뒤에만 그린다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

  // [[ADR-143]] 결정 3: 스토어가 내는 것은 **기준 순서**(레벨 내림차순)이고, 화면 순서는 사용자가
  // 캐릭터 관리에서 정한 저장 배열 순서다. core 를 안 고치는 이유는 `orderByTracked` 머리에 있다.
  const characters = orderByTracked(storeCharacters, trackedOcids ?? [])

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  // ADR-083 결정 1: 캐릭터별 실패도 인라인 문단이 아니라 토스트다(보스 스케줄러와 동일한 배선).
  // syncSchedules가 캐릭터 단위 실패를 던지지 않고 결과에 실어 반환하므로 실패의 대부분이 위의
  // 전역 error가 아니라 이 값으로 온다.
  useScheduleSyncErrorToast(selected?.error ?? null, { onRetry: () => refresh(trackedOcids ?? []) })

  // ADR-035 결정 3·6·19: 수동 모드에서는 게임 등록 여부(isRegistered)가 아니라 사용자가 앱에서
  // 관리하는 멤버십(manualTrackedContent)으로 표시 목록을 결정하고, 실제 값은 동기화 결과 또는
  // 템플릿에서 즉석 조회한다(mergeManualContentList). 멤버십의 kind('daily'/'weekly')가 저장
  // 시점에 확정돼 있어 각 탭은 자기 kind 항목만 그린다. auto 모드는 기존대로 등록 항목만 표시한다.
  // **캐릭터를 인자로 받는다**([[ADR-142]] 결정 4) — 선택된 캐릭터의 카드 목록과 레일의 링이
  // **같은 함수**를 써야 «링이 세는 것 = 화면에 보이는 것» 이 구조로 보장된다. 전에는 선택된
  // 캐릭터만 계산하면 됐으므로 이 자리가 식이었다.
  function dailyContentsOf(character: ContentCharacterView): DailyContent[] {
    const items = manualTrackedByOcid?.[character.ocid] ?? []
    return mode === 'manual'
      ? mergeManualContentList(
          items.filter((item) => item.kind === 'daily'),
          character.dailyContents,
          ORDERED_DAILY_TEMPLATE,
        )
      : // auto 모드도 수동 모드와 동일한 template 순서로 표시한다.
        orderContentsByTemplate(
          character.dailyContents.filter((content) => content.isRegistered),
          ORDERED_DAILY_TEMPLATE,
        )
  }

  function weeklyContentsOf(character: ContentCharacterView): WeeklyContent[] {
    const items = manualTrackedByOcid?.[character.ocid] ?? []
    return mode === 'manual'
      ? (mergeManualContentList(
          items.filter((item) => item.kind === 'weekly'),
          character.weeklyContents,
          ORDERED_WEEKLY_TEMPLATE,
        ) as WeeklyContent[])
      : orderContentsByTemplate(
          character.weeklyContents.filter((content) => content.isRegistered),
          ORDERED_WEEKLY_TEMPLATE,
        )
  }

  const displayDailyContents: DailyContent[] = selected === null ? [] : dailyContentsOf(selected)
  const displayWeeklyContents: WeeklyContent[] = selected === null ? [] : weeklyContentsOf(selected)

  // [[ADR-142]] 정정 1: 링 **하나를 좌·우 반원으로 가른다** — 왼쪽 일간, 오른쪽 주간. 둘 다 12시에서
  // 시작해 아래로 차므로 두 반원을 나란히 읽을 수 있다.
  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    rings: [
      { label: '일간', ...dailyContentProgress(dailyContentsOf(character)) },
      { label: '주간', ...weeklyContentProgress(weeklyContentsOf(character)) },
    ],
  }))

  // [[ADR-140]] 결정 1·2: 이 화면은 더 이상 피커를 열지 않는다 — 추적 목록을 고르는 자리는 설정
  // 하나뿐이라, 빈 상태 CTA 는 모달 대신 **설정 탭을 피커가 열린 채로** 연다.
  function goToCharacterManage(): void {
    navigation.navigate('Tabs', { screen: 'Settings', params: { openPicker: true } })
  }

  // ADR-035 결정 18: 수동 모드의 추적 항목 편집은 이 화면이 아니라 전용 관리 페이지에서 한다.
  // 잘린 버튼은 목적지를 잃는다([[ADR-141]] 결정 3) — 줄어드는 것은 시각 텍스트뿐이다.
  const manualManageButton = mode === 'manual' && (
    <Pressable role="button" className="shrink-0" onPress={() => navigation.navigate('ContentManage')}>
      <Text className="text-sm font-medium text-text-muted">컨텐츠 관리</Text>
    </Pressable>
  )

  // ADR-060: 빈 상태 문구는 탭(일간/주간)과 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다 —
  // 자동 모드가 지시하는 곳("게임에서 등록")은 앱 밖이라 데려다줄 수 없다.
  function contentEmptyProps(tab: 'daily' | 'weekly'): React.ComponentProps<typeof EmptyState> {
    const label = tab === 'daily' ? '일간' : '주간'
    if (mode === 'manual') {
      return {
        icon: ListChecksIcon,
        title: `추적할 ${label} 컨텐츠가 없습니다`,
        description: `컨텐츠 관리에서 ${tab === 'daily' ? '매일 챙길' : '주간'} 항목을 골라주세요`,
        action: { label: '컨텐츠 관리', onClick: () => navigation.navigate('ContentManage') },
      }
    }
    return {
      icon: ListChecksIcon,
      title: `등록된 ${label} 컨텐츠가 없습니다`,
      description: '게임 내 스케줄러에 등록하면 여기에 자동으로 표시됩니다',
    }
  }

  if (isEmpty) {
    // 헤더 셸을 쓰지 않는 가지라(제목 줄이 목록 없이 혼자 선다) 상단 안전영역을 여기서 먹는다 —
    // 웹의 `min-h-[calc(100dvh …)]` 자리는 `flex-1` 이다(탭 상자가 이미 탭바를 뺀 크기다).
    return (
      <View testID="screen-Content" className="flex-1 p-4" style={{ paddingTop: insets.top }}>
        <Text className="text-lg font-semibold text-text">컨텐츠 스케줄러</Text>

        <View className="flex-1 items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="표시할 캐릭터가 없습니다"
            description="캐릭터를 선택하면 일간·주간 컨텐츠를 확인할 수 있습니다"
            action={{ label: '캐릭터 선택하기', onClick: goToCharacterManage }}
          />
        </View>
      </View>
    )
  }

  return (
    <View testID="screen-Content" className="flex-1">
      <ScreenScroll
        // ADR-130 결정 1·3: 당김은 헤더 버튼과 **같은 재조회**를 부르고([[ADR-072]] 결정 2), 색만
        // 테마에서 넘긴다. `refreshing` 이 `status` 라서 헤더 버튼으로 시작한 재조회에도 플랫폼
        // 인디케이터가 뜬다 — 웹과 갈리는 유일한 자리이고 그 대가는 ADR 이 적는다.
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
          // 제목~탭까지는 화면 상단에 고정하고 그 아래 컨텐츠 목록만 스크롤되게 한다. RN 에서
          // 헤더는 스크롤 뷰의 **형제**라 `fixed` 도 spacer 도 없다([[ADR-098]] 결정 2 가 웹에서
          // 풀던 문제가 구조적으로 없다 — `PageHeader` 파일 머리).
          <PageHeader>
            {/* [[ADR-141]] 결정 1: 동기화 상태가 드롭다운 줄에서 **제목 옆**으로 올라왔다. 오른쪽
                끝은 관리 버튼 자리 그대로다 — 그쪽은 «가는 곳», 이쪽은 «상태» 라 성질이 다르다. */}
            <View className="flex-row items-center justify-between">
              <View className="shrink flex-row items-center gap-2">
                {/* 결정 3: 폭을 다투면 시각 텍스트만 줄어든다 — 제목은 화면의 이름이다. */}
                <Text className="shrink-0 text-lg font-semibold text-text">컨텐츠 스케줄러</Text>
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
              </View>
              {manualManageButton}
            </View>

            {/* 조건이 **줄 밖**에 있다 — 안에 두면 캐릭터가 없는 동안(첫 조회) 빈 줄이 남아
                `PageHeader` 의 `gap-4` 를 두 번 먹는다([[ADR-141]] 딸림 변경). */}
            {characters.length > 0 && selected !== null && (
              <CharacterRail
                entries={railEntries}
                selectedOcid={selected.ocid}
                onSelect={(ocid) => {
                  void selectCharacter(ocid)
                }}
              />
            )}

            {/* ADR-016: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
                셸 승계 카드는 보여줄 데이터가 아예 없을 때만 그린다([[ADR-061]] 결정 2). */}
            {(status === 'idle' || status === 'loading') && characters.length === 0 && (
              <LoadingState size="page" message="불러오고 있어요" />
            )}

            {characters.length > 0 && selected !== null && (
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
        {characters.length > 0 && selected !== null && (
          <View testID="pull-content" className="gap-4 px-4 pb-4">
            {activeTab === 'daily' && (
              <>
                {displayDailyContents.length === 0 && (mode === 'manual' || !selected.isStale) && (
                  <EmptyState {...contentEmptyProps('daily')} />
                )}

                {displayDailyContents.length > 0 && (
                  <View className="gap-2">
                    {displayDailyContents.map((content) => (
                      <View key={content.name}>{renderDailyContentCard(content)}</View>
                    ))}
                  </View>
                )}
              </>
            )}

            {activeTab === 'weekly' && (
              <>
                {displayWeeklyContents.length === 0 && (mode === 'manual' || !selected.isStale) && (
                  <EmptyState {...contentEmptyProps('weekly')} />
                )}

                {displayWeeklyContents.length > 0 && (
                  <View className="gap-2">
                    {displayWeeklyContents.map((content) => (
                      <View key={content.name}>{renderWeeklyContentCard(content)}</View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScreenScroll>
    </View>
  )
}
