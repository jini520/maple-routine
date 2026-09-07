/**
 * 설정 하위 페이지 `공지 상세`. 알림 탭이 곧장 여는 자리이고 목록에서도 들어간다.
 *
 * **본문은 기기에서 읽는다.** 파라미터로 받는 것은 `noticeId` 하나이고 내용은 저장소가 준다.
 * 알림에서 온 경로와 목록에서 온 경로가 같은 것을 그리게 하는 방법이 그것뿐이다. 본문을
 * 파라미터로 넘기면 두 경로가 서로 다른 내용을 그릴 수 있다.
 *
 * 그래서 서버가 죽어도 이 화면은 열린다.
 */
import { useEffect, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'

import {
  ArrowLeftIcon,
  Card,
  ExternalLinkIcon,
  ScrollTextIcon,
  Text,
} from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { getNotices } from '../../storage/notices'
import type { Notice } from '../../types/notice'

function formatDate(publishedAt: string): string {
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
}

export function SettingsNoticeDetailScreen(props: {
  route?: { params?: { noticeId?: string } }
}): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const noticeId = props.route?.params?.noticeId
  // `undefined` 는 아직 찾는 중이고 `null` 은 없다는 답이다. 둘을 합치면 여는 순간 없음 이
  // 한 프레임 스친다.
  const [notice, setNotice] = useState<Notice | null | undefined>(undefined)

  useEffect(() => {
    // `noticeId` 가 없어도 같은 비동기 경로로 답한다. 여기서 곧장 `setNotice(null)` 하면
    // 렌더 도중에 상태가 바뀌어 한 번 더 그린다.
    void getNotices().then((all) => {
      setNotice(noticeId === undefined ? null : (all.find((n) => n.id === noticeId) ?? null))
    })
  }, [noticeId])

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <Pressable
              role="button"
              aria-label="뒤로"
              onPress={() => navigation.goBack()}
              className="-ml-1 p-1"
            >
              <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
            <Text className="text-lg font-semibold text-text">공지사항</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsNoticeDetail">
        {notice === undefined ? null : notice === null ? (
          // 목록에서 잘려 나갔거나(50건 상한) 다른 기기에서 온 알림일 수 있다.
          <EmptyState icon={ScrollTextIcon} title="공지를 찾을 수 없습니다" />
        ) : (
          <Card className="gap-3 p-4">
            <View className="gap-1">
              <Text testID="notice-title" className="text-base font-semibold text-text">
                {notice.title}
              </Text>
              <Text className="text-xs text-text-disabled">{formatDate(notice.publishedAt)}</Text>
            </View>

            <Text testID="notice-body" className="text-sm leading-5 text-text">
              {notice.body}
            </Text>

            {notice.link !== undefined && (
              <Pressable
                role="link"
                aria-label="자세히 보기"
                onPress={() => {
                  void Linking.openURL(notice.link as string).catch(() => undefined)
                }}
                className="flex-row items-center gap-1.5"
              >
                <Text className="text-sm font-semibold text-primary">자세히 보기</Text>
                <ExternalLinkIcon className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden />
              </Pressable>
            )}
          </Card>
        )}
      </View>
    </ScreenScroll>
  )
}
