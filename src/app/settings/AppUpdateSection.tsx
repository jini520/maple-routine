// 관찰용 카드. 현재 실행 번들 버전과 상태를 보여주고 수동 확인을 제공한다.
// 새 버전을 실제로 받고 적용하는 동의 플로우는 `UpdatePromptModal` 이 담당한다.
//
// 섹션 제목(`앱 업데이트`)을 스스로 그리지 않는다. 이 카드가 놓이는 `/settings/about` 의 페이지
// 제목이 이미 `앱 정보`라 같은 화면에 제목이 둘이 된다. 카드만 반환한다.
//
// ══ 스토어를 부르지 않고 값을 프롭으로 받는다 ═══════════════════════════════════════════
//
// `UpdatePromptModal` 과 **같은 벽, 같은 처방**이다.
//
// ① `LiveUpdatePort` 가 던진다(`native/adapters/not-implemented.ts`). @capgo → expo-updates 는
//    SDK 교체가 아니라 매니페스트 프로토콜 자체가 바뀌는 일이라 어댑터로 덮을 수 없다.
// ② **core 의 스토어를 값으로 import 하는 것만으로 죽는다**(실측 2026-08-12, 4단계 step 0).
//    `features/live-update/store.ts` 가 모듈 최상위에서 `import.meta.env.VITE_LIVE_UPDATE_CHANNEL`
//  을 읽는데 Metro·jest 에서 `import.meta.env` 는 `undefined` 다.
//
// 그래서 타입만 core 에서 가져오고(`import type` 은 컴파일에서 지워져 모듈이 평가되지 않는다)
// 상태 열넷과 필드 이름이 두 벌이 되지 않게 한다. **표시 상태는 하나도 지우지 않고 전부 적어
// 둔다**. 지금 도달하는 것은 호출부가 심는 `unsupported` 하나뿐이지만, 그 표가 곧·
//  이 정한 계약이고 OTA 가 붙는 날 배선은 `state={useLiveUpdateStore()}`
// 한 줄이다. 어느 상태가 왜 도달 불가인지는 `SettingsAboutScreen` 이 그 자리에서 적는다.
//
// ── 그 밖에 RN 으로 옮기며 갈린 것 셋 ────────────────────────────────────────────────
//
// ① `<span>` → `Text`, `divide-y` → 두 번째 행부터 `border-t`(NativeWind 에 형제 선택자가 없다).
// ② `Button` 의 글자 클래스가 `textClassName` 으로, `disabled:opacity-50` 이 조건부 클래스로.
// ③ **`loadCurrentVersion()` 을 마운트에서 부르던 이펙트가 사라진다.** 그 호출이 곧 ①의 포트라
//    부르면 던진다. 값은 호출부가 넘기고, 이 카드는 받은 것을 그린다.
import { View } from 'react-native'

import type { LiveUpdateStatus, LiveUpdateStore } from '../../features/live-update/store'

import { Badge, Button, Card, Text } from '../../components/atoms'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'

/** 이 카드가 **읽는** 것. core 스토어에서 그대로 뽑아 두 벌이 되지 않게 한다. */
export type AppUpdateSectionState = Pick<
  LiveUpdateStore,
  'currentVersion' | 'status' | 'availableVersion' | 'downloadProgress' | 'channel'
>

/** 이 카드가 **부르는** 것. 같은 이유로 core 스토어에서 뽑는다. */
export type AppUpdateSectionActions = Pick<LiveUpdateStore, 'check'>

export interface AppUpdateSectionProps {
  state: AppUpdateSectionState
  actions: AppUpdateSectionActions
  /** `currentVersion` 이 없을 때 쓸 값. 웹은 `package.json` 을 직접 읽었다(`SettingsScreen` 주석). */
  fallbackVersion: string
}

export function AppUpdateSection(props: AppUpdateSectionProps): React.JSX.Element {
  const { state, actions } = props

  // 말줄임표는 '...'(마침표 3개)로 통일하고, 대기 문구는 '~하고 있어요'.
  // 여기의 checking/downloading은 버튼 라벨이 따로 상태를 말하므로 상태 칸은 짧게 둔다.
  const statusText: Record<LiveUpdateStatus, string> = {
    idle: '탭하여 확인',
    checking: '확인하고 있어요',
    // `현재 버전` 행 바로 아래에 놓이는 값이라 주어가 생략되면 무엇이 최신인지가
    // 문장 안에 없다. 한 단어를 더해 그 자리에서 읽히게 한다.
    'up-to-date': '최신 버전입니다',
    'update-available': `새 버전 v${state.availableVersion} 있음`,
    'store-required': '스토어 업데이트 필요',
    'confirm-cellular': '다운로드 대기',
    downloading: `다운로드 중 ${state.downloadProgress}%`,
    'ready-to-apply': '업데이트 준비됨',
    applying: '적용하고 있어요',
    // 적용·재시작 직후 1회 뜨는 안내 상태. 이 카드에서는 거의 볼 일이 없지만
    // (안내를 닫으면 idle 이 된다) 상태 하나에 문구 하나라는 계약을 비워 둘 수 없다. '최신
    // 버전입니다'로 적지 않는 이유는 확인이 실패했어도(check-error) 이 상태가 되기 때문이다.
    updated: '업데이트를 마쳤어요',
    'check-error': '확인에 실패했습니다',
    'download-error': '다운로드에 실패했습니다',
    'apply-error': '적용에 실패했습니다',
    unsupported: '이 플랫폼에서는 지원되지 않습니다',
  }

  const displayedVersion = state.currentVersion ?? props.fallbackVersion
  const isUnsupported = state.status === 'unsupported'
  const isBusy =
    state.status === 'checking' || state.status === 'downloading' || state.status === 'applying'
  const highlight =
    state.status === 'check-error' ||
    state.status === 'download-error' ||
    state.status === 'apply-error'
      ? 'text-sm text-error-ink'
      : state.status === 'update-available' ||
          state.status === 'ready-to-apply' ||
          state.status === 'store-required'
        ? 'text-sm font-medium text-primary-ink'
        : 'text-sm text-text-muted'

  return (
    <Card className="px-6">
      <View className="flex-row items-center justify-between py-4">
        <Text className="text-sm font-medium text-text">현재 버전</Text>
        <View className="flex-row items-center gap-2">
          {state.channel === 'beta' && (
            <Badge variant="primary">beta</Badge>
          )}
          <Text className="text-sm text-text-muted">{displayedVersion}</Text>
        </View>
      </View>

      <View
        className={`${SETTINGS_ROW_DIVIDER_CLASS} flex-row items-center justify-between py-4`}
      >
        <Text className="text-sm font-medium text-text">상태</Text>
        <Text className={highlight}>{statusText[state.status]}</Text>
      </View>

      {!isUnsupported && (
        <View className={`${SETTINGS_ROW_DIVIDER_CLASS} py-4`}>
          <Button
            variant="primary"
            onPress={() => {
              void actions.check()
            }}
            disabled={isBusy}
            busy={isBusy}
            className={`w-full flex-row items-center justify-center${
              isBusy ? ' opacity-50' : ''
            }`}
            textClassName="text-sm"
          >
            업데이트 확인
          </Button>
        </View>
      )}
    </Card>
  )
}
