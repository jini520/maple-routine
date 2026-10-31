/**
 * 소식 목록. **받은 분류만 그린다.** 더보기 갈래의 `전체` 가 자기 분류를 넘겨 연다.
 *
 * 이벤트 · 캐시샵은 그림 · 제목 · 기간 카드를 쌓고, 나머지는 글 줄이다. 두 분류는 본문이 그림 한 장이라 제목만으로는 무엇인지
 * 알 수 없다.
 *
 * **받아 보기 전에는 스켈레톤이 선다.** 목록 상태가 `null` 이면 아직 모르는 것이고 빈 배열이면 받아 봤는데 없는 것이다.
 * 둘을 안 가르면 첫 프레임에 `아직 받은 진행 중인 이벤트가 없습니다` 를 세우고 그다음에 카드가 들어온다.
 *
 * **저장된 목록을 먼저 그리고, 분류마다 받기에 성공하면 받은 것으로 바꾼다.** 앱 공지의 기준은 서버, 넥슨 공지의 기준은 넥슨
 * 목록이라 거기서 내린 글은 받은 목록에 없고 여기서도 사라진다. 받기가 실패하면 든 값이 그대로 선다. 빈 화면도 에러 화면도 아니다.
 */
import { useCallback, useMemo } from 'react'
import { View } from 'react-native'

import { ScrollTextIcon, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { emptyNoticeText } from '../../features/notice/notice-display'
import { refreshNoticeKinds, useNotices } from '../../features/notice/notice-query'
import { queryKeys } from '../../features/query/keys'
import { useRefetchStaleOnFocus } from '../../hooks/useRefetchStaleOnFocus'
import { useToastStore } from '../../features/toast/store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { NOTICE_KINDS, type Notice, type NoticeKind } from '../../types/notice'
import { NoticeBannerCard } from './NoticeBannerCard'
import { NoticeLines } from './NoticeLines'
import { NoticeBannerCardSkeleton, NoticeLinesSkeleton } from './NoticeSkeleton'
import { NexonMaintenanceBanner } from '../NexonMaintenanceBanner'

function newestFirst(a: Notice, b: Notice): number {
  return b.publishedAt.localeCompare(a.publishedAt)
}

/**
 * 조회 중 세우는 자리의 개수. **한 화면을 덮을 만큼**이다.
 *
 * 몇 건이 올지는 받아 봐야 알고, 스크롤 아래까지 채워 두면 도착할 때 없던 것이 사라진다.
 * 카드가 줄보다 훨씬 높아 수가 다르다.
 */
const SKELETON_CARDS = 3
const SKELETON_LINES = 6

/** 조회 중 자리. 배너 갈래면 카드 모양, 아니면 줄 모양이다. */
function NoticesSkeleton(props: { bannerKind: NoticeKind | null }): React.JSX.Element {
  const { bannerKind } = props
  if (bannerKind === null) return <NoticeLinesSkeleton lines={SKELETON_LINES} />

  return (
    <>
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <NoticeBannerCardSkeleton key={index} kind={bannerKind} />
      ))}
    </>
  )
}

export function SettingsNoticesScreen(props: {
  route?: { params?: { kinds?: NoticeKind[]; title?: string } }
}): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const kinds = props.route?.params?.kinds
  const title = props.route?.params?.title ?? '소식'
  // 배열은 매 렌더 새 참조라 deps 로 못 쓴다. 값이 실제로 바뀌었을 때만 다시 만든다.
  const kindsKey = kinds === undefined ? '' : kinds.join(',')
  // 배너 갈래면 그 갈래, 아니면 `null`. 스켈레톤이 그림 비율을 내려면 갈래를 알아야 한다.
  const bannerKind = kinds?.length === 1 && (kinds[0] === 'event' || kinds[0] === 'cashshop') ? kinds[0] : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => kinds ?? NOTICE_KINDS, [kindsKey])

  // 보는 분류의 목록은 쿼리 캐시에서 온다. 저장된 목록이 먼저 서고, 들어올 때마다 다시 받는다. 실패한 분류는 든 값이 선다.
  const byKind = useNotices(shown)
  useRefetchStaleOnFocus(queryKeys.allNotices())
  /**
   * `null` 은 **아직 모른다**. 빈 배열(받아 봤는데 없다)과 뜻이 다르다. 분류가 하나면 받은 순서 그대로이고, 여럿이면
   * 분류가 섞이므로 최근 발행순으로 선다. 한 분류라도 아직 모르는데 아무것도 못 받았으면 아직 모르는 것이다.
   */
  const notices = useMemo((): Notice[] | null => {
    const lists = shown.map((kind) => byKind[kind])
    if (lists.every((list) => list === null)) return null
    const merged = lists.flatMap((list) => list ?? [])
    return shown.length === 1 ? merged : [...merged].sort(newestFirst)
  }, [byKind, shown])

  // 당김은 사용자가 요청한 조회라 아무 일도 안 일어나면 고장으로 읽힌다. 보고 있는 분류만 다시 받는다.
  const refresh = useCallback(async (): Promise<void> => {
    const { allFailed } = await refreshNoticeKinds(shown)
    if (allFailed) useToastStore.getState().showError('소식을 불러오지 못했습니다')
  }, [shown])

  const open = (notice: Notice): void => navigation.navigate('SettingsNoticeDetail', { noticeId: notice.id })

  return (
    <ScreenScroll
      hasTabBar={false}
      onRefresh={refresh}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <BackButton onPress={() => navigation.goBack()} />
            <Text className="text-lg font-semibold text-text">{title}</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <NexonMaintenanceBanner testID="notices-maintenance-banner" />
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsNotices">
        {notices === null ? (
          <NoticesSkeleton bannerKind={bannerKind} />
        ) : notices.length === 0 ? (
          <EmptyState icon={ScrollTextIcon} title={emptyNoticeText(title)} />
        ) : bannerKind !== null ? (
          notices.map((notice) => <NoticeBannerCard key={notice.id} notice={notice} onPress={() => open(notice)} />)
        ) : (
          <NoticeLines notices={notices} onPress={open} />
        )}
      </View>
    </ScreenScroll>
  )
}
