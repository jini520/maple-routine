/**
 * 소식 목록. **받은 분류만 그린다.**
 *
 * 분류가 다섯이 되면서 한 목록에 다 담으면 점검 안내와 캐시아이템이 섞인다. 소식 카드의
 * 행마다 자기 분류를 넘기고, 안 넘기면 전부 그린다.
 *
 * 구독 스위치는 여기 없다. 목록이 넷으로 갈라져서 어느 목록에 둬도 나머지 셋이 안 보인다
 * (`SettingsNoticeAlertsScreen`).
 *
 * **사본을 먼저 그리고, 조회가 성공하면 응답으로 바꾼다.** 공지의 기준은 서버라서 서버에서 지운
 * 공지는 응답에 없고 목록에서도 사라진다. 조회가 실패하면 사본이 그대로 선다. 빈 화면도 에러
 * 화면도 아니다.
 *
 * **한 분류를 묻는 조회만 사본을 바꾼다.** 분류 없는 20건은 어느 한 분류의 최근 20건이 아니라서,
 * 그것으로 사본을 바꾸면 20건 밖으로 밀린 공지가 지워진 것처럼 사라진다.
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
import { saveNoticeResponse } from '../../features/notice/notice-copy'

import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { fetchNotices } from '../../server/notices'
import { getNotices } from '../../storage/notices'
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

    // 분류를 거른다. 사본에는 다섯 분류가 함께 있다.
    const only = (all: Notice[]): Notice[] =>
      kinds === undefined ? all : all.filter((n) => kinds.includes(n.kind))

    // 사본이 먼저다. 네트워크를 기다리는 동안 빈 화면을 보여 주지 않는다.
    void getNotices()
      .then((copy) => {
        if (alive) setNotices(only(copy))
        return fetchNotices(20, kinds ?? [])
      })
      .then(async (remote) => {
        // 실패면 사본을 그대로 둔다. 빈 배열은 실패가 아니라 서버에 공지가 없다는 답이다.
        if (remote === null) return
        if (alive) setNotices(only(remote))
        if (kinds?.length === 1) await saveNoticeResponse(kinds[0], remote)
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
