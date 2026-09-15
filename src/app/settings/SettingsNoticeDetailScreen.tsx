/**
 * 설정 하위 페이지 `공지 상세`. 알림 탭이 곧장 여는 자리이고 목록에서도 들어간다.
 *
 * **본문은 기준이 준다.** 앱 공지는 우리 서버, 넥슨 공지(`event-1374` 꼴 id)는 넥슨 상세다. 파라미터로 받는 것은
 * `noticeId` 하나다. 알림에서 온 경로와 목록에서 온 경로가 같은 것을 그리게 하는 방법이 그것뿐이다.
 *
 * 먼저 목록 사본의 같은 공지를 그리고, 조회가 성공하면 받은 것으로 바꾼다. 받은 상세는 기기에 안
 * 적는다. 조회가 실패하면 사본의 `body` 가 그대로 선다.
 *
 * **없다는 답은 실패가 아니다.** 서버의 404 · 넥슨의 400 `OPENAPI00004`(목록에서 내린 글)다. 사본에 남아 있어도
 * `공지를 찾을 수 없습니다` 를 그리고, 사본과 배너의 닫은 기록에서 뺀다.
 */
import { useEffect, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'

import {
  Card,
  ExternalLinkIcon,
  ScrollTextIcon,
  Text,
} from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { formatNoticeDate } from '../../features/notice/format'
import { forgetNotice } from '../../features/notice/notice-copy'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { NoticeBlocks } from './NoticeBlocks'
import { fetchNoticeDetail } from '../../features/notice/notice-feed'
import { getNotices } from '../../storage/notices'
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
   * 이벤트와 캐시샵은 목록 사본의 본문이 0자다(본문이 이미지 한 장이라 평문이 없다). 그래서
   * 조회가 답하기 전에는 그릴 것이 정말 아무것도 없고, 그 빈칸이 `받는 중` 인지 `못 받았다` 인지
   * 화면이 말해 줘야 한다.
   */
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let alive = true

    // `noticeId` 가 없어도 같은 비동기 경로로 답한다. 여기서 곧장 `setNotice(null)` 하면
    // 렌더 도중에 상태가 바뀌어 한 번 더 그린다.
    void getNotices()
      .then((all) => {
        const copy = noticeId === undefined ? null : (all.find((n) => n.id === noticeId) ?? null)
        if (alive) setNotice(copy)
        // 사본에 없어도 조회한다. 20건 밖 공지나 방금 온 알림은 사본에 없다.
        return noticeId === undefined ? null : fetchNoticeDetail(noticeId)
      })
      .then(async (remote) => {
        if (remote === null || remote.status === 'failed') return
        if (remote.status === 'found') {
          if (alive) setNotice(remote.notice)
          return
        }
        if (alive) setNotice(null)
        if (noticeId !== undefined) await forgetNotice(noticeId)
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
            <BackButton onPress={() => navigation.goBack()} />
            <Text className="text-lg font-semibold text-text">공지사항</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsNoticeDetail">
        {notice === undefined ? null : notice === null ? (
          // 서버에서 지웠거나, 오프라인인데 사본(분류마다 20건)에 없는 공지다.
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
                둘을 같이 그리면 같은 문장이 두 번 보인다. 조회가 닿기 전이나 오프라인에서는
                사본의 `body` 만 있고, 그때는 요약이라도 보이지 빈 화면이 되지 않는다. */}
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
