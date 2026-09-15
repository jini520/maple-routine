/**
 * 소식 목록. **받은 분류만 그린다.** 더보기 갈래의 `전체` 가 자기 분류를 넘겨 연다.
 *
 * 이벤트 · 캐시샵은 그림 · 제목 · 기간 카드를 쌓고, 나머지는 글 줄이다. 두 분류는 본문이 그림 한 장이라 제목만으로는 무엇인지
 * 알 수 없다.
 *
 * **사본을 먼저 그리고, 분류마다 받기에 성공하면 받은 것으로 바꾼다.** 앱 공지의 기준은 서버, 넥슨 공지의 기준은 넥슨 목록이라
 * 거기서 내린 글은 받은 목록에 없고 여기서도 사라진다. 받기가 실패하면 사본이 그대로 선다. 빈 화면도 에러 화면도 아니다.
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { ScrollTextIcon, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { emptyNoticeText } from '../../features/notice/notice-display'
import { refreshNoticeKind } from '../../features/notice/notice-feed'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { getNotices } from '../../storage/notices'
import { NOTICE_KINDS, type Notice, type NoticeKind } from '../../types/notice'
import { NoticeBannerCard } from './NoticeBannerCard'
import { NoticeLines } from './NoticeLines'

function newestFirst(a: Notice, b: Notice): number {
  return b.publishedAt.localeCompare(a.publishedAt)
}

export function SettingsNoticesScreen(props: {
  route?: { params?: { kinds?: NoticeKind[]; title?: string } }
}): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const kinds = props.route?.params?.kinds
  const title = props.route?.params?.title ?? '소식'
  const [notices, setNotices] = useState<Notice[]>([])
  // 배열은 매 렌더 새 참조라 deps 로 못 쓴다. 값이 실제로 바뀌었을 때만 다시 읽는다.
  const kindsKey = kinds === undefined ? '' : kinds.join(',')
  const showsBanners = kinds?.length === 1 && (kinds[0] === 'event' || kinds[0] === 'cashshop')

  useEffect(() => {
    let alive = true
    const shown = kinds ?? NOTICE_KINDS

    // 사본이 먼저다. 네트워크를 기다리는 동안 빈 화면을 보여 주지 않는다.
    // 사본을 다 읽은 뒤에 부른다. 거꾸로면 늦게 끝난 사본 읽기가 방금 받은 목록을 덮는다.
    void getNotices()
      .then((copy) => {
        if (alive) setNotices(copy.filter((n) => shown.includes(n.kind)))
      })
      .catch(() => undefined)
      .then(() => {
        for (const kind of shown) {
          void refreshNoticeKind(kind).then((received) => {
            if (!alive || received === null) return
            // 한 분류만 보면 받은 순서 그대로다. 여럿이면 분류가 섞이므로 최근 발행순으로 선다.
            setNotices((current) =>
              shown.length === 1
                ? received
                : [...current.filter((n) => n.kind !== kind), ...received].sort(newestFirst),
            )
          })
        }
      })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindsKey])

  const open = (notice: Notice): void => navigation.navigate('SettingsNoticeDetail', { noticeId: notice.id })

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <BackButton onPress={() => navigation.goBack()} />
            <Text className="text-lg font-semibold text-text">{title}</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsNotices">
        {notices.length === 0 ? (
          <EmptyState icon={ScrollTextIcon} title={emptyNoticeText(title)} />
        ) : showsBanners ? (
          notices.map((notice) => <NoticeBannerCard key={notice.id} notice={notice} onPress={() => open(notice)} />)
        ) : (
          <NoticeLines notices={notices} onPress={open} />
        )}
      </View>
    </ScreenScroll>
  )
}
