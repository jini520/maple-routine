/**
 * 소식 알림 스위치 넷.
 *
 * **목록에서 떼어 냈다.** 전에는 공지 목록과 스위치가 한 화면에 살았다 - 무엇을 켜는지 옆에
 * 두고 보게 하려던 것이었다. 분류가 다섯이 되면서 목록이 넷으로 갈라졌고, 그러면 스위치를
 * 어느 목록에 둬도 나머지 셋이 안 보인다. 넷을 한 자리에서 켜고 끄는 편이 낫다.
 *
 * **이 화면은 스위치만 있어도 거짓말을 안 한다.** 이름이 `알림 설정` 이고 실제로 그것뿐이다.
 */
import { useState } from 'react'
import { Linking, Pressable, View } from 'react-native'

import { Card, Switch, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useNoticeStore } from '../../features/notice/store'
import { anySubscribed, NOTICE_TOPICS } from '../../features/notice/topics'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'

/**
 * 아직 못 만든 알림들. **보이되 못 켠다.**
 *
 * 자리를 미리 세우는 이유는 이 화면이 `알림으로 무엇을 받을 수 있는가` 를 말하는 자리이고,
 * 그 목록에서 빠져 있으면 없는 기능인지 못 찾는 기능인지 모르기 때문이다. 준비 중이라고
 * 적어 두면 둘이 갈린다.
 *
 * 여기 사는 것은 이것들이 **FCM 토픽이 아니라 기기가 스스로 띄우는 예약 알림**이라서다.
 * 만들 때 `features/` 로 옮긴다.
 */
const SCHEDULER_ALERTS: readonly { key: string; label: string }[] = [
  { key: 'schedule-incomplete', label: '미완료 스케줄 알림' },
  { key: 'weekly-summary', label: '주간 결산 알림' },
]

/** 구역 이름. 다섯과 둘이 성질이 달라(서버가 쏘는 것 · 기기가 띄우는 것) 카드만으로는 안 갈린다. */
function SectionLabel(props: { children: string }): React.JSX.Element {
  return <Text className="px-2 text-xs text-text-disabled">{props.children}</Text>
}

export function SettingsNoticeAlertsScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const subscriptions = useNoticeStore((state) => state.subscriptions)
  const pending = useNoticeStore((state) => state.pending)
  const setSubscribed = useNoticeStore((state) => state.setSubscribed)
  const setAllSubscribed = useNoticeStore((state) => state.setAllSubscribed)
  const blockedByPermission = useNoticeStore((state) => state.blockedByPermission)
  /** 누른 값을 덮은 구독. 스위치가 왕복을 기다리지 않게 하는 값. */
  const shown = { ...subscriptions, ...pending }
  // **저장하지 않고 파생한다.** 저장하면 `전체는 켜졌는데 넷은 다 꺼진` 상태가 생기고, 그때
  // 화면은 스위치가 켜졌다고 말하면서 알림은 안 온다.
  const on = anySubscribed(shown)
  /**
   * 스위치를 못 켠 이유. **삼키면 화면이 아무 말도 안 한다.**
   *
   * 구독은 FCM 왕복이라 실패하는 길이 여럿이다(APNs 토큰이 아직 없다 · 망이 끊겼다 · 토픽
   * 이름이 틀렸다). 그때 스위치는 그냥 안 켜지고, 사용자는 그것을 `눌러도 반응이 없다` 로 본다.
   */
  const [failure, setFailure] = useState<string | null>(null)

  /** 요청의 실패를 카드로 옮기는 함수. */
  const report = (action: Promise<void>): void => {
    setFailure(null)
    void action.catch((error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error))
    })
  }

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <BackButton onPress={() => navigation.goBack()} />
            <Text className="text-lg font-semibold text-text">알림 설정</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsNoticeAlerts">
        {/* 전체 스위치. 이것이 꺼져 있으면 아래 넷을 아예 안 그린다 - 못 쓰는 스위치를 흐리게
            세워 두면 사용자가 그것을 눌러 보고 나서야 못 쓴다는 것을 안다. */}
        <Card className="px-6">
          <View className="flex-row items-center py-4">
            <Text className="shrink text-sm text-text">알림 받기</Text>
            <Switch
              on={on}
              label="알림 받기"
              size="lg"
              className="ml-auto"
              onToggle={() => {
                // 켜면 기본 묶음이 켜지고 끄면 전부 꺼진다.
                report(setAllSubscribed(!on))
              }}
            />
          </View>
        </Card>

        {/* 못 켠 이유를 그대로 적는다. 스위치가 조용히 안 켜지는 것보다 낫다. */}
        {failure !== null && (
          <Card className="px-6">
            <View className="py-4">
              <Text className="text-sm text-error-ink">알림을 켜지 못했어요</Text>
              <Text className="text-xs text-text-disabled">{failure}</Text>
            </View>
          </Card>
        )}

        {/* **전체 스위치 밖에 산다.** 전체를 켜려다 권한에 막히면 넷은 안 켜지고 `on` 은 거짓인데,
            안내가 그 안에 있으면 화면이 아무 말도 안 하고 사용자는 스위치가 안 켜지는 것만 본다.
            iOS 는 여기서 팝업을 다시 못 띄우므로 OS 설정으로 보내는 것 말고 할 수 있는 일이 없다. */}
        {blockedByPermission && (
          <Card className="px-6">
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
            </Card>
        )}

        {on && <SectionLabel>일반</SectionLabel>}
        {on && (
          <Card className="px-6">
            {NOTICE_TOPICS.map((topic, index) => (
            <View
              key={topic.key}
              className={`flex-row items-center py-4 ${index === 0 ? '' : SETTINGS_ROW_DIVIDER_CLASS}`}
            >
              <Text className="shrink text-sm text-text">{topic.label}</Text>
              <Switch
                on={shown[topic.key]}
                label={`${topic.label} 알림`}
                size="lg"
                className="ml-auto"
                onToggle={() => {
                  report(setSubscribed(topic.key, !shown[topic.key]))
                }}
              />
            </View>
          ))}

        </Card>
        )}

        {on && <SectionLabel>스케줄러</SectionLabel>}
        {on && (
          <Card className="px-6">
            {SCHEDULER_ALERTS.map((alert, index) => (
              <View
                key={alert.key}
                className={`flex-row items-center py-4 ${index === 0 ? '' : SETTINGS_ROW_DIVIDER_CLASS}`}
              >
                <Text className="shrink text-sm text-text-disabled">{alert.label}</Text>
                {/* 스위치 자리에 `준비 중` 을 세운다. 못 켜는 스위치를 그려 두면 사용자가 눌러
                    보고 나서야 못 쓴다는 것을 알고, 그 사이 화면은 고장으로 읽힌다. */}
                <Text className="ml-auto shrink-0 text-xs text-text-disabled">준비 중</Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScreenScroll>
  )
}
