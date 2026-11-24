import { Card, IconBadge, Text, type IconBadgeIcon } from '../../atoms'
import { Pressable, View } from 'react-native'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon: IconBadgeIcon | 'leaf'
  title: string
  description?: string
  /** 문구가 지시하는 목적지가 앱 안에 있을 때만 주는 CTA. 없으면 만들지 않는다. */
  action?: EmptyStateAction
  size?: 'page' | 'inline'
}

export function EmptyState(props: EmptyStateProps): React.JSX.Element {
  const { icon, title, description, action, size = 'inline' } = props
  const isPage = size === 'page'

  const body = (
    <>
      <IconBadge testID="empty-state-badge" icon={icon} size={isPage ? 64 : 48} />

      <View className="gap-1">
        <Text
          testID="empty-state-title"
          className="text-center text-sm font-bold text-text"
        >
          {title}
        </Text>
        {description !== undefined && (
          <Text
            testID="empty-state-description"
            className={
              isPage
                ? 'max-w-[220px] text-center text-xs text-text-muted'
                : 'mx-auto max-w-[240px] text-center text-xs text-text-muted'
            }
          >
            {description}
          </Text>
        )}
      </View>

      {action !== undefined && (
        <Pressable
          role="button"
          onPress={action.onClick}
          className={`rounded-full bg-primary ${isPage ? 'px-5 py-2.5' : 'px-4 py-2'}`}
        >
          <Text className={`font-semibold text-on-primary ${isPage ? 'text-sm' : 'text-xs'}`}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </>
  )

  return isPage ? (
    <View testID="empty-state" className="items-center gap-4">
      {body}
    </View>
  ) : (
    <Card testID="empty-state" className="items-center gap-3 px-4 py-8">
      {body}
    </Card>
  )
}
