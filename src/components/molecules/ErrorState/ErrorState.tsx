import { AlertTriangleIcon, Text } from '../../atoms'
import { Pressable, View } from 'react-native'

interface ErrorStateAction {
  label: string
  onClick: () => void
}

export interface ErrorStateProps {
  title: string
  description?: string
  /**
   * 그 원인을 실제로 푸는 행동만 준다 — 401·429에 "다시 시도"를 주지 말 것. **생략하려면 위 계약대로 그 자리의 진행 경로를 다른 것이 제공해야 한다.**
   */
  action?: ErrorStateAction
}

export function ErrorState(props: ErrorStateProps): React.JSX.Element {
  return (
    <View
      testID="error-state"
      role="alert"
      className="min-h-[120px] flex-1 items-center justify-center gap-3 px-4"
    >
      <AlertTriangleIcon className="h-7 w-7 text-error-ink" strokeWidth={1.75} aria-hidden />

      <View className="gap-1">
        <Text testID="error-state-title" className="text-center text-sm font-semibold text-text">
          {props.title}
        </Text>
        {props.description !== undefined && (
          <Text
            testID="error-state-description"
            className="mx-auto max-w-[240px] text-center text-xs text-text-muted"
          >
            {props.description}
          </Text>
        )}
      </View>

      {props.action !== undefined && (
        // 재시도는 파괴적 동작이 아니라 진행 동작이라 primary다(삭제 버튼의 border-error text-error-ink 와 구분).
        <Pressable role="button" onPress={props.action.onClick} className="rounded-full bg-primary px-4 py-2">
          <Text className="text-xs font-semibold text-on-primary">{props.action.label}</Text>
        </Pressable>
      )}
    </View>
  )
}
