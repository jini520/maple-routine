import { AlertTriangleIcon, Text } from '../../atoms'
import { Pressable, View } from 'react-native'

interface StaleBannerAction {
  label: string
  onClick: () => void
}

export interface StaleBannerProps {
  message: string
  /** 재시도가 실제로 통하는 실패에만 준다. 429·401 에는 액션이 없다. */
  action?: StaleBannerAction
}

export function StaleBanner(props: StaleBannerProps): React.JSX.Element {
  return (
    <View
      testID="stale-banner"
      role="alert"
      className="mb-3 flex-row items-center gap-2 rounded-[10px] bg-error-tint px-3 py-2.5"
    >
      <AlertTriangleIcon className="h-4 w-4 shrink-0 text-error-ink" strokeWidth={2} aria-hidden />
      <Text className="min-w-0 flex-1 text-left text-xs text-text">{props.message}</Text>
      {props.action !== undefined && (
        <Pressable role="button" onPress={props.action.onClick} className="shrink-0">
          <Text className="text-xs font-semibold text-primary-ink">{props.action.label}</Text>
        </Pressable>
      )}
    </View>
  )
}
