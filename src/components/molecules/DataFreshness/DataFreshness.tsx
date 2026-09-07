/**
 * 이 화면의 데이터가 언제 것인가를 말하는 한 줄. 제목 줄 바로 아래에 선다.
 *
 * **받은 적이 없어도 자리를 지킨다.** 글자만 비고 높이는 그대로다. 값이 들어오는 순간 줄이
 * 생기면 헤더가 16 만큼 내려앉고, 그 아래 화면 전체가 한 번 밀린다. 콜드 스타트 첫 진입에서
 * 실제로 일어난다.
 *
 * 그 16 은 `PageHeader` 가 이 줄을 안 그리는 화면에서도 바닥에 비워 두는 값과 같다. 그래야
 * 탭을 오갈 때 제목이 안 뛴다.
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

export function DataFreshness({ fetchedAt }: DataFreshnessProps): React.JSX.Element {
  return (
    <Text testID="data-freshness" className="h-4 text-11 text-text-disabled">
      {formatFetchedAt(fetchedAt)}
    </Text>
  )
}
