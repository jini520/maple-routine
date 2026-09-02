import { Card, MapleSweepSpinner, Text } from '../../atoms'

export interface LoadingStateProps {
  message: string
  size?: 'page' | 'inline'
}

export function LoadingState(props: LoadingStateProps): React.JSX.Element {
  const isPage = (props.size ?? 'inline') === 'page'

  return (
    <Card
      testID="loading-state"
      role="status"
      aria-busy
      className={`items-center justify-center gap-3 p-6${isPage ? ' min-h-[132px]' : ''}`}
    >
      <MapleSweepSpinner size={isPage ? 32 : 24} className="text-primary" />
      <Text className={isPage ? 'text-center text-sm text-text-muted' : 'text-center text-xs text-text-muted'}>
        {props.message}
      </Text>
    </Card>
  )
}
