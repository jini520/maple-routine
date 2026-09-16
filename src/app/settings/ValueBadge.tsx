/**
 * 고를 수 있는 값. 눌러서 바꾸는 것이라 배지로 선다.
 *
 * 화면 둘이 쓴다. 더보기의 `캐릭터 · 테마` 카드와 설정의 `스케줄 관리 방법` 이다. 한 자리에 두는
 * 이유는 이것이 모양이 아니라 약속이라서다 - 배지가 붙은 행은 눌러서 값을 고른다.
 * 안을 미리 보여 줄 뿐인 값은 배지가 아니라 평문이다(`AppSettingsScreen` 의 `SummaryValue`).
 */
import { Badge } from '../../components/atoms'

export function ValueBadge(props: { children: React.ReactNode }): React.JSX.Element {
  return <Badge variant="outline">{props.children}</Badge>
}
