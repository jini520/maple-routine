import { useCountUp } from '../../../hooks/useCountUp'

export interface AnimatedMesoProps {
  identity: string
  value: number
}

/**
 * 메소 금액이 바뀌면 목표까지 굴려서 보여준다 ([[ADR-087]] 결정 6).
 *
 * 숫자만 그린다. 단위와 그 앞 공백은 호출부에서 붙인다.
 *
 * @param props.identity 숫자를 구분하는 키. 같으면 이어서 굴리고, 바뀌면 그 키로 마지막에 그렸던
 *   값에서 다시 굴린다.
 * @param props.value 목표 금액.
 *
 * @example
 * <Text>
 *   <AnimatedMeso identity={`total|${tab}`} value={totalMeso} />{' '}
 *   <Text className="text-xs">메소</Text>
 * </Text>
 */
export function AnimatedMeso(props: AnimatedMesoProps): React.JSX.Element {
  const displayed = useCountUp(props.identity, props.value)
  return <>{displayed.toLocaleString()}</>
}
