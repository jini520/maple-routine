/**
 * 첫 화면 today — 위젯 격자.
 *
 * ## 이 화면이 하는 일은 셋뿐이다
 *
 * ① 스토어 넷과 캐시를 **한 번** 읽어 `TodayViewModel` 하나를 만들고 ② 그것을 `WidgetGrid` 에
 * 프롭으로 넘기고 ③ 진입·당김·헤더 버튼의 조회를 건다. **위젯은 스토어를 모른다**(
 * 결정 4) — 위젯이 각자 구독하면 트리거가 위젯 수만큼 늘고, 같은 드롭 기록을 보는 셋이 각자의
 * 시점에서 읽는다.
 *
 * 조립 자체는 `view-model.ts` 의 순수 함수가 한다. 이 파일에 남는 것은 **어느 스토어의 어느
 * 값인가** 라는 배선뿐이고, 그래서 판정이 한 줄도 여기 없다.
 *
 * ## 진입 자동 조회 — 트리거는 **하나**다
 *
 * *"`today` 는 그 순차 밖의 **네 번째 트리거**"* — `prehydrate` 가 탭 스토어 셋을 순차로 예열하고
 *  이 화면은 그 밖에서 **한 번** 더 부른다. 다른 스케줄러 화면과 같은
 * 횟수이고, 같은 문(`loadTrackedOcids`)이다.
 *
 * - **게이트가 있는 문으로만 들어간다.** `refresh()` 를 진입에서 부르면 의 10분 TTL 을
 *   통째로 우회해 예열이 방금 받은 응답을 한 번 더 받는다. 그래서 진입 경로는 `loadTrackedOcids`
 *  하나이고, 그 함수 안의 `{ auto: true }` 가 게이트를 태운다.
 * - **스토어 넷을 각자 트리거하지 않는다.** 보스·수익 스토어는 `prehydrate` 가 이미 같은 회차로
 *   예열했고, 여기서 또 부르면 예열한 것을 다시 조회 다. **대가는 적어 둔다** — 이 화면에 오래
 *   머무는 동안 TTL 이 만료되면 컨텐츠 쪽만 다시 동기화되고 보스·수익 위젯은 그 탭에 들어갈 때까지
 *   옛 스냅샷을 그린다. 당김·헤더 버튼(아래)은 셋을 모두 새로 읽으므로 사용자가 원하면 즉시 풀린다.
 * - **`drop-history` 는 이 셋과 다른 축이다** — 예열 목록에 없고(열린 질문: 더할지는
 *  실측 뒤에) 네트워크도 안 탄다(전 기간 SQLite 통독). 그래서 동기화 트리거 수에
 *   들지 않고, 그 스토어를 자동으로 부르는 화면은 여기뿐이다.
 *
 * **step 0 의 단일 비행이 이 자리를 안전하게 만든다** — 게이트 플래그는 성공이 아니라 *시도*를
 * 기록하고 신선도는 호출이 **끝나야** 참이 되므로, 이 화면의 동기화가 날아가는 중에 스케줄 탭으로
 * 들어가면 게이트가 `시도함 = true` · `신선함 = false` 를 보고 같은 호출을 한 번 더 낸다.
 *
 * ## 당김과 헤더 버튼은 **같은 재조회**이고, 그쪽은 셋을 다 읽는다
 *
 * 명시적 재조회는 TTL 을 무시한다 — 사용자가 지금 이 화면을 최신으로 를
 * 요구한 것이라, 이 화면이 그리는 스토어 셋을 **동시에** 새로 읽는다. 세 번 나갈 것 같지만
 * `syncSchedules` 의 단일 비행이 셋을 한 회차로 합쳐 **네트워크는 한 바퀴**다.
 */

import { usePullRefresh } from '../use-pull-refresh'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'

import { useDropHistoryStore } from '../../features/boss-profit/drop-history-store'
import { getBossDropRecordsRevision } from '../../storage/boss-drops'
import { useBossProfitStore } from '../../features/boss-profit/store'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getRepresentativeCharacter } from '../../storage/character-selection'
import type { CharacterBasicProfile } from '../../types'

import { RefreshCwIcon, Text } from '../../components/atoms'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../constants/style/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { useThemeAppearance } from '../../theme/context'
import { buildTodayViewModel } from './view-model'
import { WidgetGrid } from './WidgetGrid'

export function TodayScreen(): React.JSX.Element {
  const content = useContentSchedulerStore()
  const boss = useBossSchedulerStore()
  const profit = useBossProfitStore()
  const dropHistory = useDropHistoryStore()
  const { mode } = useTrackingModeStore()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()

  // 프로필과 대표 표식은 스토어가 아니라 저장소에서 온다(둘 다 이 화면이 처음 읽는 자리는 아니고,
  // `character-basic-cache` 는 보스 수익·히스토리가 이미 같은 방식으로 읽는다).
  const [profilesByOcid, setProfilesByOcid] = useState<Readonly<Record<string, CharacterBasicProfile>>>(
    {},
  )
  const [representativeOcid, setRepresentativeOcid] = useState<string | null>(null)

  useEffect(() => {
    // 파일 머리 **진입 자동 조회** — 게이트가 있는 문 하나. 드롭 기록은 아래 포커스 훅이 맡는다.
    void content.loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 드롭 기록 스냅샷을 **포커스가 소유한다.**
   *
   * 이 화면은 탭이라 한 번 마운트되면 계속 살아 있다 — 마운트 이펙트는 앱 실행당 한 번뿐이고,
   * 그 사이 보스 수익·가격 입력 화면이 `boss_drop_records` 를 바꾸면 최고가·미입력·드롭 가뭄
   * 셋이 **옛 스냅샷에 굳는다**(가 짚은 진입 시점이 실행당 한 번 의 대가).
   *
   * 그래서 today 에 진입 시점 을 되돌려 준다. 다만 그 스토어는 **전 기간을 통째로 읽으므로**
   *  포커스마다 읽으면 비싸다 — 저장 계층의 리비전을 물어 **실제로 바뀌었을 때만**
   * 다시 읽는다. 첫 포커스는 `status === 'idle'` 로 걸려 마운트 조회를 대신한다.
   */
  // 최신 스토어 값을 **deps 없이** 읽는 자리. 구독값을 deps 에 넣으면 `load()` 가 일으킨 상태
  // 변화가 이펙트를 다시 돌려 실패 → 재조회 → 실패 가 무한히 돈다 — 포커스는 사건이지
  // 상태 변화가 아니다.
  const dropHistoryRef = useRef(dropHistory)
  // 렌더 중에 ref 를 쓰면 `react-hooks/refs` 가 잡는다 — 커밋 뒤에 채운다. 포커스 콜백은 렌더가
  // 아니라 이펙트에서 도므로 이 시점이면 이미 최신이다.
  useEffect(() => {
    dropHistoryRef.current = dropHistory
  })

  useFocusEffect(
    useCallback(() => {
      const store = dropHistoryRef.current
      if (store.status === 'loading') return
      if (store.status === 'idle' || store.loadedRevision !== getBossDropRecordsRevision()) {
        void store.load()
      }
    }, []),
  )

  // : 화면 순서는 사용자가 캐릭터 관리에서 정한 저장 배열 순서다.
  const orderedOcids = content.trackedOcids ?? []
  // 배열 자체는 매 렌더 새 참조라 deps 로 쓸 수 없다 — 목록이 실제로 바뀌었을 때만 다시 읽는다.
  const orderedOcidsKey = orderedOcids.join(',')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const ocids = orderedOcidsKey === '' ? [] : orderedOcidsKey.split(',')
      const [representative, entries] = await Promise.all([
        getRepresentativeCharacter().catch(() => null),
        Promise.all(
          ocids.map(async (ocid) => [ocid, await getCachedCharacterBasic(ocid).catch(() => null)] as const),
        ),
      ])
      if (cancelled) return

      setRepresentativeOcid(representative)
      // 캐시에 없는 캐릭터는 **항목을 만들지 않는다** — 이름 없이 카드를 그릴 수 없고, ocid 는
      // 사용자에게 뜻이 없는 값이라 대신 넣지 않는다(`drop-history-store` 와 같은 규칙).
      setProfilesByOcid(
        Object.fromEntries(
          entries.flatMap(([ocid, entry]) => (entry === null ? [] : [[ocid, entry.profile] as const])),
        ),
      )
    })()

    return () => {
      cancelled = true
    }
  }, [orderedOcidsKey])

  const viewModel = buildTodayViewModel({
    // 렌더당 한 번만 만든다 — 두 번 부르면 두 시각이 기간 경계를 사이에 두고 갈려 카운트다운과
    // 기간 판정이 서로 다른 기간을 가리킬 수 있다(`BossProfitScreen` 과 같은 규칙).
    now: new Date(),
    orderedOcids,
    representativeOcid,
    profilesByOcid,
    contentCharacters: content.characters,
    bossCharacters: boss.characters,
    trackingMode: mode,
    // 계열마다 **주인이 다르다** — 컨텐츠 멤버십을 보스 스토어 사본에서
    // 읽으면 수동 컨텐츠를 추가해도 이 화면만 옛 값에 굳는다(그 사본을 갱신하는 것은 보스 변경뿐).
    manualContentByOcid: content.manualTrackedByOcid,
    manualBossByOcid: boss.manualTrackedByOcid,
    characterIssues: profit.characterIssues,
    // **보고 있는 것 이 아니라 지금 기간 이다** — `rows` 는 `filterRowsForTab` 이
    // `cycle` 까지 걸러 낸 보스 수익 화면의 한 조각이라, 그 화면을 월간 탭으로 옮기기만 해도 이
    // 화면의 주간 수익·결정석 한도가 함께 비었다(사용자 보고 2026-08-19). 이번 주로 자르는 것은
    // 종전대로 뷰모델이 한다.
    profitRows: profit.currentPeriodRows,
    profitDropsByRowKey: profit.dropsByRowKey,
    dropGroups: dropHistory.groups,
    drought: dropHistory.drought,
  })

  const isSyncing =
    content.status === 'loading' || boss.status === 'loading' || profit.status === 'loading'

  /**
   * 헤더 버튼과 당김이 **같은 함수**를 부른다 — 파일 머리 당김과 헤더 버튼.
   *
   * **`allSettled` 다**. 넷이 서로 독립이라 하나가 실패해도 나머지를 기다려야
   * 하고(각자 자기 스토어에 실패를 적는다), 넷이 다 끝나야 당김 인디케이터를 닫을 수 있다 —
   * 종전에는 `void` 넷이라 언제 끝났는가 라는 값 자체가 없었다.
   */
  async function refreshAll(): Promise<void> {
    await Promise.allSettled([
      content.refresh(content.trackedOcids ?? []),
      boss.refresh(boss.trackedOcids ?? []),
      profit.refresh(profit.trackedOcids ?? []),
      dropHistory.load(),
    ])
  }

  // **당김이 시작한 회차에만** 인디케이터가 돈다 — `isSyncing` 은 여전히 제목
  // 옆 **조회 중...** 과 헤더 버튼의 스피너가 쓴다(그쪽은 자동 조회도 말해야 하는 자리다).
  const pull = usePullRefresh(refreshAll)

  return (
    <View testID="screen-Today" className="flex-1">
      <ScreenScroll
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
          <PageHeader>
            {/* 과 같은 줄이다 — 제목 옆이 **이 화면이 얼마나 최신인가** 의 자리다.
                오른쪽에 가는 곳이 없어 `justify-between` 만 빠진다. */}
            <PageHeaderTitleRow>
              <View className="shrink flex-row items-center gap-2">
                <Text className="shrink-0 text-lg font-semibold text-text">today</Text>
                <Text className="shrink text-15 text-text-muted" numberOfLines={1}>
                  {/* 스케줄러 두 화면이 **선택된 캐릭터의 `syncedAt`** 을 쓰는 자리다. 이 화면에는
                      선택이 없으므로 **페이지 전체 기준** 값을 쓴다 — 보스 수익 스토어의
                      `lastSyncedAt` 이 이미 그 뜻이고, 건너뛴 진입에서도 갱신된다. */}
                  {isSyncing ? '조회 중...' : formatSyncedAt(profit.lastSyncedAt)}
                </Text>
                <Pressable
                  role="button"
                  aria-label="새로고침"
                  onPress={() => {
                    void refreshAll()
                  }}
                  className="shrink-0 p-2"
                >
                  <AnimatedView
                    testID="refresh-icon"
                    style={isSyncing && !reduceMotion ? SPIN_ANIMATION : undefined}
                  >
                    <RefreshCwIcon className="h-4 w-4 text-primary-ink" strokeWidth={2} aria-hidden />
                  </AnimatedView>
                </Pressable>
              </View>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* 좌우 16 은 앱 공통 `px-4` 라 **화면의 래퍼가 준다** — 격자가 또 주면 두 겹이 되는데,
            열 폭 계산은 `창폭 − 32` 를 전제로 서 있다(`WidgetGrid` 파일 머리). */}
        <View className="px-4 pb-4">
          <WidgetGrid data={viewModel} />
        </View>
      </ScreenScroll>
    </View>
  )
}
