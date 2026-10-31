/**
 * 관찰용 카드. 지금 도는 번들의 버전과 상태를 보여주고 수동 확인을 주는 조각.
 *
 * 새 버전을 받고 적용하는 동의 플로우는 `UpdatePromptModal` 이 갖는다.
 *
 * 섹션 제목을 스스로 안 그린다. 이 카드가 놓이는 화면의 제목이 이미 `앱 정보` 라 같은 화면에
 * 제목이 둘이 된다.
 *
 * 상태를 스토어에서 직접 안 읽고 프롭으로 받는다. 문구 열넷의 계약이 이 파일에 있다.
 */
import { View } from 'react-native'

import type { LiveUpdateStatus, LiveUpdateStore } from '../../features/live-update/store'
import { formatAppVersion } from '../../lib/app-version'

import { Badge, Button, Card, Text } from '../../components/atoms'
import { SETTINGS_CARD_CLASS, SETTINGS_ROW_CLASS } from './row-class'

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
  /** `currentVersion` 이 없을 때 쓸 값. */
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
    'update-available': `새 버전 v${state.availableVersion === null ? null : formatAppVersion(state.availableVersion)} 있음`,
    'store-required': '스토어 업데이트 필요',
    'confirm-cellular': '다운로드 대기',
    downloading: `다운로드 중 ${state.downloadProgress}%`,
    // 묻지 않고 받는 중. 모달이 없어 받는 중이라는 것이 보이는 곳은 이 줄뿐이다.
    'background-downloading': `다운로드 중 ${state.downloadProgress}%`,
    'ready-to-apply': '업데이트 준비됨',
    applying: '적용하고 있어요',
    'check-error': '확인에 실패했습니다',
    'download-error': '다운로드에 실패했습니다',
    'background-download-error': '다운로드에 실패했습니다',
    'apply-error': '적용에 실패했습니다',
    unsupported: '이 플랫폼에서는 지원되지 않습니다',
  }

  const displayedVersion = formatAppVersion(state.currentVersion ?? props.fallbackVersion)
  const isUnsupported = state.status === 'unsupported'
  const isBusy =
    state.status === 'checking' ||
    state.status === 'downloading' ||
    state.status === 'background-downloading' ||
    state.status === 'applying'
  const highlight =
    state.status === 'check-error' ||
    state.status === 'download-error' ||
    state.status === 'background-download-error' ||
    state.status === 'apply-error'
      ? 'text-sm text-error-ink'
      : state.status === 'update-available' ||
          state.status === 'ready-to-apply' ||
          state.status === 'store-required'
        ? 'text-sm font-semibold text-primary-ink'
        : 'text-sm text-text-muted'

  return (
    <Card className={SETTINGS_CARD_CLASS}>
      <View className={SETTINGS_ROW_CLASS}>
        <Text className="text-sm font-semibold text-text">현재 버전</Text>
        <View className="flex-row items-center gap-2">
          {state.channel === 'beta' && (
            <Badge variant="primary">beta</Badge>
          )}
          <Text className="text-sm text-text-muted">{displayedVersion}</Text>
        </View>
      </View>

      <View className={SETTINGS_ROW_CLASS}>
        <Text className="text-sm font-semibold text-text">상태</Text>
        <Text className={highlight}>{statusText[state.status]}</Text>
      </View>

      {!isUnsupported && (
        // 버튼은 칸이 아니라 칸 아래에 선다. 누르는 것이 표시 행과 같은 칸에 담기면 값처럼 읽힌다.
        <View className="pb-0.5 pt-1.5">
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
          >
            업데이트 확인
          </Button>
        </View>
      )}
    </Card>
  )
}
