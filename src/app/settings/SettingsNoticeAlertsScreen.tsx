/**
 * 소식 알림 스위치 넷.
 *
 * **목록에서 떼어 냈다.** 전에는 공지 목록과 스위치가 한 화면에 살았다 - 무엇을 켜는지 옆에
 * 두고 보게 하려던 것이었다. 분류가 다섯이 되면서 목록이 넷으로 갈라졌고, 그러면 스위치를
 * 어느 목록에 둬도 나머지 셋이 안 보인다. 넷을 한 자리에서 켜고 끄는 편이 낫다.
 *
 * **이 화면은 스위치만 있어도 거짓말을 안 한다.** 이름이 `알림 설정` 이고 실제로 그것뿐이다.
 */
import { useRef, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'

import { Card, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useNoticeStore } from '../../features/notice/store'
import { anySubscribed, DEFAULT_SUBSCRIPTIONS, NOTICE_TOPICS } from '../../features/notice/topics'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { NO_SUBSCRIPTIONS, type NoticeSubscriptions } from '../../types/notice'
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

/**
 * 구독 스위치. `BossDropSheet` 의 `EffectToggle` 과 같은 모양이다.
 *
 * 공용 컴포넌트로 안 뽑는다. 소비자가 둘뿐이라 뽑으면 자리만 하나 늘고 규칙은 안 준다.
 */
function SubscribeToggle(props: {
  on: boolean
  label: string
  onToggle: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
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

export function SettingsNoticeAlertsScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const subscriptions = useNoticeStore((state) => state.subscriptions)
  const setSubscribed = useNoticeStore((state) => state.setSubscribed)
  const setAllSubscribed = useNoticeStore((state) => state.setAllSubscribed)
  const blockedByPermission = useNoticeStore((state) => state.blockedByPermission)
  // **저장하지 않고 파생한다.** 저장하면 `전체는 켜졌는데 넷은 다 꺼진` 상태가 생기고, 그때
  // 화면은 스위치가 켜졌다고 말하면서 알림은 안 온다.
  /**
   * 누른 직후에 그릴 값. **스위치가 왕복을 기다리지 않게 한다.**
   *
   * 구독은 FCM 왕복이라 수백 밀리초에서 몇 초가 걸린다. 스토어 값만 그리면 그동안 스위치가
   * 안 움직여서 사용자는 `눌러도 반응이 없다` 로 읽고 한 번 더 누른다.
   *
   * **저장 순서는 그대로다.** 구독이 성공해야 저장하고 스토어가 바뀐다 - 여기서 바꾸는 것은
   * 그리는 값뿐이고, 왕복이 끝나면 이 값을 버려 스토어가 진실이 된다. 실패하면 스위치가 제자리로
   * 돌아가고 아래 카드가 이유를 말한다.
   */
  const [preview, setPreview] = useState<NoticeSubscriptions | null>(null)
  const shown = preview ?? subscriptions
  const on = anySubscribed(shown)
  /**
   * 왕복이 도는 중. **이 사이의 터치는 무시한다.**
   *
   * 스위치가 즉시 움직여도 실제 구독은 몇 초 걸릴 수 있고, 그 사이 여러 번 누르면 요청이
   * 겹친다. 겹치면 나중에 끝난 것이 이기므로 **마지막으로 누른 것과 다른 상태로 끝날 수 있다.**
   *
   * 하나가 도는 동안 넷을 다 막는 이유는 다섯이 같은 값 하나를 고쳐 쓰기 때문이다. 스토어가
   * 저장할 값을 자기 왕복이 끝난 뒤에 읽으므로, 다른 스위치가 그 사이에 끼면 서로를 덮는다.
   *
   * ⚠️ **상태가 아니라 ref 다.** 리액트는 한 번의 이벤트 묶음에서 상태를 몰아 반영하므로,
   * 빠르게 두 번 누르면 둘째 핸들러가 아직 옛 상태를 본다. 막으려는 것이 정확히 그 연타라
   * 여기서는 즉시 읽히는 값이어야 한다.
   */
  const busyRef = useRef(false)
  /**
   * 스위치를 못 켠 이유. **삼키면 화면이 아무 말도 안 한다.**
   *
   * 구독은 FCM 왕복이라 실패하는 길이 여럿이다(APNs 토큰이 아직 없다 · 망이 끊겼다 · 토픽
   * 이름이 틀렸다). 그때 스위치는 그냥 안 켜지고, 사용자는 그것을 `눌러도 반응이 없다` 로 본다.
   */
  const [failure, setFailure] = useState<string | null>(null)

  /**
   * 누른 결과를 먼저 그리고, 왕복이 끝나면 그리는 값을 스토어에 돌려준다.
   *
   * @param next 성공했을 때 스토어가 갖게 될 값. 그것을 미리 그린다.
   */
  const run = (next: NoticeSubscriptions, action: Promise<void>): void => {
    busyRef.current = true
    setFailure(null)
    setPreview(next)
    void action
      .catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        busyRef.current = false
        // 성공이든 실패든 미리 그린 값을 버린다. 스토어가 바뀌었으면 그대로이고, 아니면 되돌아간다.
        setPreview(null)
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
            <SubscribeToggle
              on={on}
              label="알림 받기"
              onToggle={() => {
                if (busyRef.current) return
                // 켜면 기본 묶음이 켜지고 끄면 전부 꺼진다. 스토어가 하는 일과 같은 값을 그린다.
                run(on ? NO_SUBSCRIPTIONS : DEFAULT_SUBSCRIPTIONS, setAllSubscribed(!on))
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
              <SubscribeToggle
                on={shown[topic.key]}
                label={`${topic.label} 알림`}
                onToggle={() => {
                  if (busyRef.current) return
                  const next = { ...shown, [topic.key]: !shown[topic.key] }
                  run(next, setSubscribed(topic.key, !shown[topic.key]))
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
