/**
 * **한시적 자리표시자** — step 8~11 이 위젯 여덟을 하나씩 진짜 그림으로 갈아 끼우고, 마지막 하나가
 * 바뀌면 이 파일은 통째로 사라진다.
 *
 * 이 단계가 검증하는 것은 **격자**다([[ADR-146]] 결정 2). 내용이 섞이면 «타일이 적어 둔 자리에
 * 서는가» 가 실패했을 때 원인이 흐려지므로, stub 은 자기 id 만 말한다.
 *
 * 레지스트리가 `.ts` 로 남을 수 있는 이유이기도 하다 — 그 파일은 «어떤 위젯이 있는가» 라는 표이고,
 * 표에 JSX 가 섞이면 위젯이 하나 늘 때마다 표와 그림을 같은 자리에서 고치게 된다.
 */

import { Text } from 'react-native'

import type { WidgetId, WidgetProps } from './types'

export function stubWidget(id: WidgetId): React.ComponentType<WidgetProps> {
  function Stub(): React.JSX.Element {
    return (
      <Text testID={`widget-${id}`} className="p-3 text-xs text-text-muted">
        {id}
      </Text>
    )
  }

  Stub.displayName = `StubWidget(${id})`
  return Stub
}
