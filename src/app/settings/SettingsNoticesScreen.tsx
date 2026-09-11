/**
 * 소식 목록. **받은 분류만 그린다.**
 *
 * 분류가 다섯이 되면서 한 목록에 다 담으면 점검 안내와 캐시아이템이 섞인다. 소식 카드의
 * 행마다 자기 분류를 넘기고, 안 넘기면 전부 그린다.
 *
 * 구독 스위치는 여기 없다. 목록이 넷으로 갈라져서 어느 목록에 둬도 나머지 셋이 안 보인다
 * (`SettingsNoticeAlertsScreen`).
 *
 * **로컬을 먼저 그리고 서버를 그 위에 얹는다.** 서버 조회가 실패하면 로컬 것만 보인다.
 * 빈 화면도 에러 화면도 아니다. 조회 실패를 화면 전체의 실패로 만들지 않는다.
 *
 * 서버가 필요한 이유가 있다. 푸시는 **배경에서 도착만 하고 안 탭한 것을 못 쌓는다**
 * (`notification` 페이로드가 OS 에서 그려지고 JS 를 안 깨운다). 그래서 알림은 떴는데 목록에는
 * 없는 공지가 생기고, 그 구멍을 이 조회가 메운다.
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Card, ChevronRightIcon, ScrollTextIcon, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { formatNoticeDate } from '../../features/notice/format'

import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { fetchNotices } from '../../server/notices'
import { getNotices, mergeNotices } from '../../storage/notices'
import type { Notice, NoticeKind } from '../../types/notice'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'

export function SettingsNoticesScreen(props: {
  route?: { params?: { kinds?: NoticeKind[]; title?: string } }
}): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const kinds = props.route?.params?.kinds
  const title = props.route?.params?.title ?? '소식'
  const [notices, setNotices] = useState<Notice[]>([])
  // 배열은 매 렌더 새 참조라 deps 로 못 쓴다. 값이 실제로 바뀌었을 때만 다시 읽는다.
  const kindsKey = kinds === undefined ? '' : kinds.join(',')

  useEffect(() => {
    let alive = true

    // 분류를 거른다. 기기에 쌓인 것과 서버에서 받은 것에 같은 잣대를 댄다.
    const only = (all: Notice[]): Notice[] =>
      kinds === undefined ? all : all.filter((n) => kinds.includes(n.kind))

    // 로컬이 먼저다. 네트워크를 기다리는 동안 빈 화면을 보여 주지 않는다.
    void getNotices()
      .then((local) => {
        if (alive) setNotices(only(local))
        // 서버 것을 받아 기기에 합친다. 같은 id 는 서버가 이긴다(발송 뒤 오타를 고칠 수 있다).
        return fetchNotices(20, kinds ?? [])
      })
      .then(async (remote) => {
        if (remote.length === 0) return
        await mergeNotices(remote)
        const merged = await getNotices()
        if (alive) setNotices(only(merged))
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindsKey])

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
          <EmptyState icon={ScrollTextIcon} title={`아직 받은 ${title}이 없습니다`} />
        ) : (
          <Card className="px-6">
            {notices.map((notice, index) => (
              <View key={notice.id} className={index === 0 ? '' : SETTINGS_ROW_DIVIDER_CLASS}>
                <Pressable
                  role="button"
                  aria-label={notice.title}
                  testID="notice-row"
                  onPress={() =>
                    navigation.navigate('SettingsNoticeDetail', { noticeId: notice.id })
                  }
                  className="flex-row items-center gap-2 py-4"
                >
                  <View className="shrink">
                    <Text className="text-sm text-text">{notice.title}</Text>
                    <Text className="text-xs text-text-disabled">
                      {formatNoticeDate(notice.publishedAt)}
                    </Text>
                  </View>
                  <ChevronRightIcon
                    className="ml-auto h-4 w-4 shrink-0 text-text-disabled"
                    strokeWidth={2}
                    aria-hidden
                  />
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScreenScroll>
  )
}
