/**
 * 설정 하위 페이지 `공지사항`. 받은 공지 목록과 구독 스위치가 한 화면에 산다.
 *
 * 스위치가 설정 본화면이 아니라 여기 있는 이유는, 이 페이지의 주된 내용이 스위치가 아니라
 * **목록**이기 때문이다. 사용자가 무엇을 켜는지 옆에 두고 본다.
 *
 * **로컬을 먼저 그리고 서버를 그 위에 얹는다.** 서버 조회가 실패하면 로컬 것만 보인다.
 * 빈 화면도 에러 화면도 아니다. 조회 실패를 화면 전체의 실패로 만들지 않는다.
 *
 * 서버가 필요한 이유가 있다. 푸시는 **배경에서 도착만 하고 안 탭한 것을 못 쌓는다**
 * (`notification` 페이로드가 OS 에서 그려지고 JS 를 안 깨운다). 그래서 알림은 떴는데 목록에는
 * 없는 공지가 생기고, 그 구멍을 이 조회가 메운다.
 */
import { useEffect, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'

import { ArrowLeftIcon, Card, ChevronRightIcon, ScrollTextIcon, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useNoticeStore } from '../../features/notice/store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { fetchNotices } from '../../server/notices'
import { getNotices, mergeNotices } from '../../storage/notices'
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
  const blockedByPermission = useNoticeStore((state) => state.blockedByPermission)
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    let alive = true

    // 로컬이 먼저다. 네트워크를 기다리는 동안 빈 화면을 보여 주지 않는다.
    void getNotices()
      .then((local) => {
        if (alive) setNotices(local)
        // 서버 것을 받아 기기에 합친다. 같은 id 는 서버가 이긴다(발송 뒤 오타를 고칠 수 있다).
        return fetchNotices()
      })
      .then(async (remote) => {
        if (remote.length === 0) return
        await mergeNotices(remote)
        const merged = await getNotices()
        if (alive) setNotices(merged)
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
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

          {/* 켜려 했는데 권한이 없을 때만 뜬다. iOS 는 여기서 팝업을 다시 못 띄우므로
              OS 설정으로 보내는 것 말고 할 수 있는 일이 없다. 조용히 두면 사용자는
              스위치가 안 켜지는 것을 고장으로 읽는다. */}
          {blockedByPermission && (
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <Pressable
                role="button"
                aria-label="알림 권한 설정 열기"
                onPress={() => {
                  void Linking.openSettings().catch(() => undefined)
                }}
                className="py-4"
              >
                <Text className="text-sm text-error-ink">기기에서 알림이 꺼져 있어요</Text>
                <Text className="text-xs text-text-disabled">
                  눌러서 설정을 열고 이 앱의 알림을 켜 주세요
                </Text>
              </Pressable>
            </View>
          )}
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
