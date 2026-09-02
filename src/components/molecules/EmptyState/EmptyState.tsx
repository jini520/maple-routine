import { Card, MapleLeaf, Text } from '../../atoms'
import { Pressable, View } from 'react-native'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }> | 'leaf'
  title: string
  description?: string
  /** 문구가 지시하는 목적지가 앱 안에 있을 때만 준다. 없으면 CTA를 만들지 않는다. */
  action?: EmptyStateAction
  size?: 'page' | 'inline'
}

export function EmptyState(props: EmptyStateProps): React.JSX.Element {
  const { icon: Icon, title, description, action, size = 'inline' } = props
  const isPage = size === 'page'

  const body = (
    <>
      <View
        testID="empty-state-badge"
        aria-hidden
        className={`items-center justify-center rounded-full bg-primary-tint ${
          isPage ? 'h-[84px] w-[84px]' : 'h-14 w-14'
        }`}
      >
        {/* 마크 색은 primary 계열로 통일 — primary-ink 는 라이트 테마에선 더 또렷하지만 레테(다크)에서
            배지 배경에 묻힌다(그 테마만 primary-ink 가 primary 보다 어둡다). */}
        {Icon === 'leaf' ? (
          <MapleLeaf size={isPage ? 42 : 28} className="text-primary-ink" />
        ) : (
          <Icon className={`text-primary-ink ${isPage ? 'h-10 w-10' : 'h-7 w-7'}`} strokeWidth={1.75} />
        )}
      </View>

      <View className="gap-1">
        <Text
          testID="empty-state-title"
          className={`text-center font-semibold text-text ${isPage ? 'text-base' : 'text-sm'}`}
        >
          {title}
        </Text>
        {description !== undefined && (
          <Text
            testID="empty-state-description"
            className={
              isPage
                ? 'max-w-[220px] text-center text-sm text-text-muted'
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
