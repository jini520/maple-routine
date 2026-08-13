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
// ④ 모달은 셸 **바깥의 형제**다. 웹에서 그래야 했던 이유(`z-50` 이 셸의 스태킹 컨텍스트에 갇혀
//    탭바 아래로 간다)는 RN 에 없지만 — `Modal` 이 별도 네이티브 윈도우다 — 자리는 같다.
import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReducedMotion } from 'react-native-reanimated'

import type { CharacterPickerEntry, DailyContent, WeeklyContent } from '@core/types'
import { useContentSchedulerStore } from '@core/features/content-scheduler/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { formatSyncedAt } from '@core/features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '@core/features/schedule-sync/use-sync-error-toast'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import { getCharacterPickerRoster, toScheduleSyncError } from '@core/features/schedule-sync/schedule-sync'
import type { ScheduleSyncError } from '@core/features/schedule-sync/schedule-sync'
import { mergeManualContentList, orderContentsByTemplate } from '@core/lib/manual-content-merge'
import { CONTENT_TEMPLATE } from '@core/lib/scheduler-content-template'
import { categorizeContentEntries, WEEKLY_CATEGORY_ORDER } from '@core/lib/content-category'

import { CharacterSelectDropdown } from '../../components/molecules/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/organisms/CharacterTrackingPicker/CharacterTrackingPicker'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { ProgressModal } from '../../components/organisms/ProgressModal/ProgressModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../lib/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { ListChecksIcon, RefreshCwIcon } from '../../lib/icons'
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
    characters,
    error,
    trackedOcids,
    selectedOcid,
    manualTrackedByOcid,
    loadTrackedOcids,
    saveTrackedOcids,
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
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  // ADR-063: 동기화 전체 실패는 인라인 문단이 아니라 토스트로 알린다 — 지속 상태("n분 전")는
  // 새로고침 옆 표기가 이미 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })

  // ADR-053 결정 3: 후보 목록 조회의 로딩·실패는 조회를 소유한 화면이 관리해 피커에 내려준다.
  // 초기값은 "마운트 직후 조회가 시작되는가"(= 피커가 이미 열려 있는가)와 같다.
  const [isRosterLoading, setIsRosterLoading] = useState(isPickerOpen)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)
  // ADR-062: 재조회 트리거. 피커를 여는 것과 재시도가 같은 초기화(reloadRoster)를 공유하고,
  // 이 값이 바뀌면 아래 조회 effect가 다시 돈다.
  const [rosterReloadNonce, setRosterReloadNonce] = useState(0)
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-015: 후보 목록에 이미지·access_flag가 필요해져 피커를 열 때만 조회한다
  // (마운트 시 매번 호출하면 화면에 들어오기만 해도 캐릭터 수만큼 병렬 호출이 발생함).
  // ADR-016: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(전체를 기다리지 않음).
  // ADR-017 결정 6: character/list 응답을 기다리는 동안에도 character-basic-cache에 이미
  // 있는 캐릭터(추적 여부 무관)는 즉시 먼저 보여줘, 피커를 열 때마다 짧게 비어 보이던 문제를
  // 완화한다.
  // ADR-053 결정 3: 조회 결과(Promise)를 버리지 않고 로딩·실패 상태로 남긴다 — 401/429는 reject로
  // 나오므로 finally에서 반드시 로딩을 해제해야 스피너가 영구히 걸리지 않는다. roster는 재조회
  // 시작 시에도 비우지 않는다(캐시로 보여주던 목록을 지우면 ADR-016 캐시 우선 표시가 무력화된다).
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

  // ADR-115 결정 7: 감지 지점은 동기화만이 아니다 — 피커 로스터가 맞는 401도 같은 키 무효화라
  // 같은 진입점을 부른다(동기화 쪽 위임은 useScheduleSyncErrorToast 안에 있다).
  // ADR-116 결정 1: 429도 같은 진입점을 탄다 — 이름만 바뀌었을 뿐 이 자리는 그대로다.
  useApiKeyNotice(rosterError)

  // ADR-101 결정 1: `null` 은 "0명"이 아니라 **"저장소를 아직 안 읽었다"** 다. 둘을 `||` 로 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다 — 빈 상태는 읽고 확인한 뒤에만 그린다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

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
  const manualItems = selected !== null ? (manualTrackedByOcid?.[selected.ocid] ?? []) : []

  const displayDailyContents: DailyContent[] =
    selected === null
      ? []
      : mode === 'manual'
        ? mergeManualContentList(
            manualItems.filter((item) => item.kind === 'daily'),
            selected.dailyContents,
            ORDERED_DAILY_TEMPLATE,
          )
        : // auto 모드도 수동 모드와 동일한 template 순서로 표시한다.
          orderContentsByTemplate(
            selected.dailyContents.filter((content) => content.isRegistered),
            ORDERED_DAILY_TEMPLATE,
          )

  const displayWeeklyContents: WeeklyContent[] =
    selected === null
      ? []
      : mode === 'manual'
        ? (mergeManualContentList(
            manualItems.filter((item) => item.kind === 'weekly'),
            selected.weeklyContents,
            ORDERED_WEEKLY_TEMPLATE,
          ) as WeeklyContent[])
        : // auto 모드도 수동 모드와 동일한 template 순서로 표시한다.
          orderContentsByTemplate(
            selected.weeklyContents.filter((content) => content.isRegistered),
            ORDERED_WEEKLY_TEMPLATE,
          )

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

  // ADR-053 결정 3: 피커를 여는 유일한 경로 — 여는 순간 로딩·실패를 초기화한다(닫았다 다시 열면
  // 위 useEffect가 재조회하므로 직전 실패가 남아 있으면 안 된다). 초기화를 effect 본문이 아니라
  // 이 이벤트 핸들러에 두는 이유는 effect 본문의 동기 setState가 cascading render를 만들기 때문.
  // ADR-062 트레이드오프: 여는 경로와 재시도가 같은 초기화를 쓴다 — 재조회 로직을 한 곳으로 모은다.
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

  // ADR-035 결정 18: 수동 모드의 추적 항목 편집은 이 화면이 아니라 전용 관리 페이지에서 한다.
  const manualManageButton = mode === 'manual' && (
    <Pressable role="button" onPress={() => navigation.navigate('ContentManage')}>
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

  if (isEmpty) {
    // 헤더 셸을 쓰지 않는 가지라(제목 줄이 목록 없이 혼자 선다) 상단 안전영역을 여기서 먹는다 —
    // 웹의 `min-h-[calc(100dvh …)]` 자리는 `flex-1` 이다(탭 상자가 이미 탭바를 뺀 크기다).
    return (
      <View testID="screen-Content" className="flex-1 p-4" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-text">컨텐츠 스케줄러</Text>
          {characterManageButton}
        </View>

        <View className="flex-1 items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="표시할 캐릭터가 없습니다"
            description="캐릭터를 선택하면 일간·주간 컨텐츠를 확인할 수 있습니다"
            action={{ label: '캐릭터 선택하기', onClick: openPicker }}
          />
        </View>

        {trackingModals}
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
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-text">컨텐츠 스케줄러</Text>
              <View className="flex-row items-center gap-4">
                {manualManageButton}
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

      {trackingModals}
    </View>
  )
}
