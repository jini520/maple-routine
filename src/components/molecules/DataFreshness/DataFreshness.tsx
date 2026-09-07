/**
 * 이 화면의 데이터가 언제 것인가를 말하는 한 줄. 제목 줄 바로 아래에 선다.
 *
 * **받은 적이 없으면 아무것도 안 그린다.** 빈 줄을 두면 제목 아래가 이유 없이 벌어진다.
 *
 * 값을 프롭으로 받는다. 스토어를 여기서 읽으면 `components/` 가 `features/` 를 알게 되고
 * 그 방향은 계층 테스트가 막는다.
 */
import { Text } from '../../atoms'
import { formatFetchedAt } from '../../../lib/data-freshness'

export interface DataFreshnessProps {
  /** 마지막으로 데이터를 부른 시각(ISO 8601). */
  fetchedAt: string | null | undefined
}

export function DataFreshness({ fetchedAt }: DataFreshnessProps): React.JSX.Element | null {
  const text = formatFetchedAt(fetchedAt)
  if (text === '') return null

  return (
    <Text testID="data-freshness" className="text-11 text-text-disabled">
      {text}
    </Text>
  )
}
