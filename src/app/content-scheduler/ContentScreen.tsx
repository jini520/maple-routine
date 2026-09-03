/**
 * 컨텐츠 스케줄러. 일간/주간 콘텐츠 진행 상태(`docs/features/content-scheduler.md`).
 *
 * **이 화면에 걸린 ADR 이 스물하나다.** 대부분은 화면에 안 보이는 판단이라(캐시 우선 표시 · 실패의
 * 목적지 · 빈 상태의 판정 시점) 아래 주석이 그 자리를 지목한다. 목록은
 * `docs/migration/parity-inventory.md` §2.3.
 */
import { useEffect } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import type { DailyContent, WeeklyContent } from '../../types'
import { useContentSchedulerStore, type ContentCharacterView } from '../../features/content-scheduler/store'
import { resolveSelectedCharacter } from '../../features/character-selection/selected-character'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '../../features/schedule-sync/use-sync-error-toast'
import {
  displayedDailyContents,
  displayedWeeklyContents,
  type DisplayedContentsInput,
} from '../../features/content-scheduler/displayed-contents'

import { ListChecksIcon, RefreshCwIcon, Text } from '../../components/atoms'
import { dailyContentProgress, weeklyContentProgress } from './content-completion'

import { CharacterRail, type CharacterRailEntry } from '../../components/organisms/CharacterRail/CharacterRail'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../constants/style/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { useTopSafeAreaPx } from '../../lib/safe-area'
import { orderByTracked } from '../../lib/scheduler/tracked-order'
import { useThemeAppearance } from '../../theme/context'
import { useOpenTab } from '../use-open-tab'
import { useScreenNavigation } from '../use-screen-navigation'
import { usePullRefresh } from '../use-pull-refresh'
import { renderDailyContentCard } from './DailyContentCards'
import { renderWeeklyContentCard } from './WeeklyContentCards'

export function ContentScreen(): React.JSX.Element {
  const {
    status,
    characters: storeCharacters,
    error,
    trackedOcids,
    manualTrackedByOcid,
    loadTrackedOcids,
    refresh,
    // 탭은 스토어 소유다. 이 화면이 언마운트돼도 살아남고, 관리 페이지가
    // 같은 값을 읽어 보던 탭 그대로 열린다.
    activeTab,
    setActiveTab,
  } = useContentSchedulerStore()
  // 선택은 화면·스토어가 아니라 **여기 한 벌**이다.
  const { selectedOcid, select } = useCharacterSelectionStore()
  // **당김이 시작한 회차에만** 인디케이터가 돈다. 헤더 버튼·자동 조회는 같은
  // 재조회를 부르지만 인디케이터는 안 연다. 버튼은 자기 스피너와 **조회 중...** 을 이미 갖고 있고
  // 자동 조회는 원래 조용해야 하는 것이다.
  const pull = usePullRefresh(() => refresh(trackedOcids ?? []))
  const { mode } = useTrackingModeStore()
  const navigation = useScreenNavigation()
  const openTab = useOpenTab()
  const topSafeAreaPx = useTopSafeAreaPx()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()
  // 동기화 전체 실패는 인라인 문단이 아니라 토스트로 알린다. 지속 상태("n분 전")는
  // 새로고침 옆 표기가 이미 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `null` 은 "0명"이 아니라 **"저장소를 아직 안 읽었다"** 다. 둘을 `||` 로 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다. 빈 상태는 읽고 확인한 뒤에만 그린다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

  // 스토어가 내는 것은 **기준 순서**(레벨 내림차순)이고, 화면 순서는 사용자가
  // 캐릭터 관리에서 정한 저장 배열 순서다. core 를 안 고치는 이유는 `orderByTracked` 머리에 있다.
  const characters = orderByTracked(storeCharacters, trackedOcids ?? [])

  // 화면 넷이 **같은 규칙**으로 고른다. 선택만 합치고 폴백을 화면마다 두면
  // **공유했는데 화면마다 다른 캐릭터** 가 다시 생긴다.
  const selected = resolveSelectedCharacter(selectedOcid, characters)

  // 캐릭터별 실패도 인라인 문단이 아니라 토스트다(보스 스케줄러와 동일한 배선).
  // syncSchedules가 캐릭터 단위 실패를 던지지 않고 결과에 실어 반환하므로 실패의 대부분이 위의
  // 전역 error가 아니라 이 값으로 온다.
  useScheduleSyncErrorToast(selected?.error ?? null, { onRetry: () => refresh(trackedOcids ?? []) })

  // 판정은 `features/content-scheduler/displayed-contents` 가 갖는다. today 의 `남은 스케줄`이
  // 같은 수를 세므로 화면 안에 두면 두 벌이 되고, 실제로 갈라졌던 자리다(모든 캐릭터 **일퀘 18**).
  // 여기 남는 것은 **스토어에서 꺼내 넘기는 일** 뿐이다.
  function contentsInputOf(character: ContentCharacterView): DisplayedContentsInput {
    return {
      dailyContents: character.dailyContents,
      weeklyContents: character.weeklyContents,
      manualItems: manualTrackedByOcid?.[character.ocid] ?? [],
    }
  }

  function dailyContentsOf(character: ContentCharacterView): DailyContent[] {
    return displayedDailyContents(contentsInputOf(character), mode)
  }

  function weeklyContentsOf(character: ContentCharacterView): WeeklyContent[] {
    return displayedWeeklyContents(contentsInputOf(character), mode)
  }

  const displayDailyContents: DailyContent[] = selected === null ? [] : dailyContentsOf(selected)
  const displayWeeklyContents: WeeklyContent[] = selected === null ? [] : weeklyContentsOf(selected)

  // 링 **하나를 좌·우 반원으로 가른다**. 왼쪽 일간, 오른쪽 주간. 둘 다 12시에서
  // 시작해 아래로 차므로 두 반원을 나란히 읽을 수 있다.
  const railEntries: CharacterRailEntry[] = characters.map((character) => ({
    ocid: character.ocid,
    characterName: character.characterName,
    level: character.level ?? null,
    imageUrl: character.imageUrl ?? null,
    rings: [
      // 링이 세는 것도 요구 레벨을 탄다. 링·카드 목록·today 가 같은 판정을
      // 봐야 이 성립한다.
      { label: '일간', ...dailyContentProgress(dailyContentsOf(character), character.level ?? null) },
      { label: '주간', ...weeklyContentProgress(weeklyContentsOf(character), character.level ?? null) },
    ],
  }))

  // 이 화면은 더 이상 피커를 열지 않는다. 추적 목록을 고르는 자리는 설정
  // 하나뿐이라, 빈 상태 CTA 는 모달 대신 **설정 탭을 피커가 열린 채로** 연다.
  function goToCharacterManage(): void {
    openTab('Settings', { openPicker: true })
  }

  // 수동 모드의 추적 항목 편집은 이 화면이 아니라 전용 관리 페이지에서 한다.
  // 잘린 버튼은 목적지를 잃는다. 줄어드는 것은 시각 텍스트뿐이다.
  const manualManageButton = mode === 'manual' && (
    <Pressable role="button" className="shrink-0" onPress={() => navigation.navigate('ContentManage')}>
      <Text className="text-sm font-medium text-text-muted">컨텐츠 관리</Text>
    </Pressable>
  )

  // 빈 상태 문구는 탭(일간/주간)과 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다.
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
    // 헤더 셸을 쓰지 않는 가지라(제목 줄이 목록 없이 혼자 선다) 상단 안전영역을 여기서 먹는다.
    // 높이는 `flex-1` 이다. 탭 상자가 이미 탭바를 뺀 크기다.
    return (
      <View testID="screen-Content" className="flex-1 p-4" style={{ paddingTop: topSafeAreaPx }}>
        {/* 헤더 셸을 안 쓰는 가지에서도 제목 줄은 같은 프리미티브다. 빈 상태와
            목록 상태를 오갈 때 제목이 튀면 그것이 가장 눈에 띄는 자리다. */}
        <PageHeaderTitleRow>
          <Text className="text-lg font-semibold text-text">컨텐츠 스케줄러</Text>
        </PageHeaderTitleRow>

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
        // 당김은 헤더 버튼과 **같은 재조회**를 부르고, 색만
        // 테마에서 넘긴다. `refreshing` 이 `status` 라서 헤더 버튼으로 시작한 재조회에도 플랫폼
        // 인디케이터가 뜬다. 그 대가는 ADR 이 적는다.
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
          // 제목~탭도 목록과 함께 스크롤된다. 헤더는 `ScreenScroll` 의 첫 자식이다.
          <PageHeader>
            {/* 동기화 상태가 드롭다운 줄에서 **제목 옆**으로 올라왔다. 오른쪽
                끝은 관리 버튼 자리 그대로다. 그쪽은 **가는 곳**, 이쪽은 **상태** 라 성질이 다르다. */}
            <PageHeaderTitleRow className="justify-between">
              <View className="shrink flex-row items-center gap-2">
                {/* 폭을 다투면 시각 텍스트만 줄어든다. 제목은 화면의 이름이다. */}
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
            </PageHeaderTitleRow>

            {/* 조건이 **줄 밖**에 있다. 안에 두면 캐릭터가 없는 동안(첫 조회) 빈 줄이 남아
                `PageHeader` 의 `gap-4` 를 두 번 먹는다(딸림 변경). */}
            {characters.length > 0 && selected !== null && (
              <CharacterRail
                entries={railEntries}
                selectedOcid={selected.ocid}
                onSelect={(ocid) => {
                  void select(ocid)
                }}
              />
            )}

            {/* 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다.
                셸 승계 카드는 보여줄 데이터가 아예 없을 때만 그린다. */}
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
                      <View key={content.name}>{renderDailyContentCard(content, selected.level ?? null)}</View>
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
                      <View key={content.name}>{renderWeeklyContentCard(content, selected.level ?? null)}</View>
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
