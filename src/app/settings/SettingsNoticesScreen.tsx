/**
 * 설정 하위 페이지 `공지사항`. 받은 공지 목록과 구독 스위치가 한 화면에 산다.
 *
 * 스위치가 설정 본화면이 아니라 여기 있는 이유는, 이 페이지의 주된 내용이 스위치가 아니라
 * **목록**이기 때문이다. 사용자가 무엇을 켜는지 옆에 두고 본다.
 *
 * **목록은 기기에 쌓인 것을 그린다.** 푸시로 받은 것과 서버에서 받은 것이 이미 합쳐져 있어서
 * 이 화면은 출처를 안 가린다. 서버가 죽어도 받은 공지는 열린다.
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { ArrowLeftIcon, Card, ChevronRightIcon, ScrollTextIcon, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useNoticeStore } from '../../features/notice/store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { getNotices } from '../../storage/notices'
import type { Notice } from '../../types/notice'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'

/** 발행일. 목록과 상세가 같은 모양으로 읽는다. */
function formatDate(publishedAt: string): string {
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
}

/**
 * 구독 스위치. `BossDropSheet` 의 `EffectToggle` 과 같은 모양이다.
 *
 * 공용 컴포넌트로 안 뽑는다. 소비자가 둘뿐이라 뽑으면 자리만 하나 늘고 규칙은 안 준다.
 */
function SubscribeToggle(props: { on: boolean; onToggle: () => void }): React.JSX.Element {
  return (
    <Pressable
      role="switch"
      aria-checked={props.on}
      aria-label="공지 알림"
      onPress={props.onToggle}
      className="ml-auto shrink-0 flex-row items-center"
    >
      <View
        className={`h-4 w-7 shrink-0 flex-row items-center rounded-full ${props.on ? 'bg-primary' : 'bg-border-strong'}`}
      >
        <View
          className="h-3 w-3 rounded-full bg-white"
          style={{ transform: [{ translateX: props.on ? 14 : 2 }] }}
        />
      </View>
    </Pressable>
  )
}

export function SettingsNoticesScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const subscribed = useNoticeStore((state) => state.subscribed)
  const setSubscribed = useNoticeStore((state) => state.setSubscribed)
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    void getNotices().then(setNotices)
  }, [])

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
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsNotices">
        <Card className="px-6">
          <View className="flex-row items-center py-4">
            <View className="shrink">
              <Text className="text-sm text-text">공지 알림</Text>
              <Text className="text-xs text-text-disabled">
                점검과 업데이트 소식을 알림으로 받아요
              </Text>
            </View>
            <SubscribeToggle
              on={subscribed}
              onToggle={() => {
                // 실패는 여기서 삼킨다. 스위치는 스토어 값을 그리므로 실패하면 안 켜진 채로
                // 남고, 그 자체가 사용자에게 보이는 결과다.
                void setSubscribed(!subscribed).catch(() => undefined)
              }}
            />
          </View>
        </Card>

        {notices.length === 0 ? (
          <EmptyState icon={ScrollTextIcon} title="아직 받은 공지가 없습니다" />
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
                      {formatDate(notice.publishedAt)}
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
