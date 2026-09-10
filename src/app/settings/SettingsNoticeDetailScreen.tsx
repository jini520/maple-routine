/**
 * 설정 하위 페이지 `공지 상세`. 알림 탭이 곧장 여는 자리이고 목록에서도 들어간다.
 *
 * **본문은 기기에서 읽는다.** 파라미터로 받는 것은 `noticeId` 하나이고 내용은 저장소가 준다.
 * 알림에서 온 경로와 목록에서 온 경로가 같은 것을 그리게 하는 방법이 그것뿐이다. 본문을
 * 파라미터로 넘기면 두 경로가 서로 다른 내용을 그릴 수 있다.
 *
 * 그래서 서버가 죽어도 이 화면은 열린다. **서버는 그 위에 얹는다** - 푸시는 4KB 상한 때문에
 * 본문이 잘려 올 수 있고, 조회가 그 자리를 온전한 것으로 덮는다. 조회가 실패하면 잘린 채로
 * 보이지 빈 화면이 되지 않는다.
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
import { formatNoticeDate } from '../../features/notice/format'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { NoticeBlocks } from './NoticeBlocks'
import { fetchNotice } from '../../server/notices'
import { getNotices, mergeNotices } from '../../storage/notices'
import type { Notice } from '../../types/notice'

export function SettingsNoticeDetailScreen(props: {
  route?: { params?: { noticeId?: string } }
}): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const noticeId = props.route?.params?.noticeId
  // `undefined` 는 아직 찾는 중이고 `null` 은 없다는 답이다. 둘을 합치면 여는 순간 없음 이
  // 한 프레임 스친다.
  const [notice, setNotice] = useState<Notice | null | undefined>(undefined)
  /**
   * 서버 조회가 끝났는가. **본문이 빈 공지에만 쓴다.**
   *
   * 이벤트와 캐시샵은 푸시가 본문을 0자로 실어 온다(본문이 이미지 한 장이라 평문이 없다).
   * 그래서 탭해서 들어온 직후에는 그릴 것이 정말 아무것도 없고, 그 빈칸이 «받는 중» 인지
   * «못 받았다» 인지 화면이 말해 줘야 한다.
   */
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let alive = true

    // `noticeId` 가 없어도 같은 비동기 경로로 답한다. 여기서 곧장 `setNotice(null)` 하면
    // 렌더 도중에 상태가 바뀌어 한 번 더 그린다.
    void getNotices()
      .then((all) => {
        const local = noticeId === undefined ? null : (all.find((n) => n.id === noticeId) ?? null)
        if (alive) setNotice(local)
        // 로컬에 없어도 조회한다. 알림을 안 탭해 안 쌓인 공지를 목록에서 열 수 있다.
        return noticeId === undefined ? null : fetchNotice(noticeId)
      })
      .then(async (remote) => {
        if (remote === null) return
        // 받은 김에 기기에도 남긴다. 다음에는 서버 없이 열린다.
        await mergeNotices([remote])
        if (alive) setNotice(remote)
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setSettled(true)
      })

    return () => {
      alive = false
    }
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
              <Text className="text-xs text-text-disabled">{formatNoticeDate(notice.publishedAt)}</Text>
            </View>

            {/* 블록이 있으면 그것이 본문이다. `body` 는 목록 미리보기용으로 잘린 평문이라,
                둘을 같이 그리면 같은 문장이 두 번 보인다. 넥슨 공지는 조회가 닿기 전까지
                푸시로 온 `body` 만 있고, 그때는 잘린 채로 보이지 빈 화면이 되지 않는다. */}
            {notice.blocks !== undefined ? (
              <NoticeBlocks blocks={notice.blocks} />
            ) : notice.body !== '' ? (
              <Text testID="notice-body" className="text-sm leading-5 text-text">
                {notice.body}
              </Text>
            ) : (
              // 그릴 것이 정말 없는 자리. 빈칸으로 두면 사용자는 그것을 고장으로 읽는다.
              <Text testID="notice-body-pending" className="text-sm text-text-disabled">
                {settled ? '본문을 받지 못했어요' : '본문을 받는 중이에요'}
              </Text>
            )}

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
