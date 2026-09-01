// 보여줄 항목이 있는 채로 실패했을 때 목록 위에 얹는 한 줄([[ADR-062]] 결정 4).
//
// 캐시 stub이 네트워크보다 먼저 방출되므로([[ADR-017]] 결정 6) 예열([[ADR-016]])이 끝난 정상
// 경로에서는 실패해도 목록이 그대로 남는다 — 이 배너가 없으면 실패의 대다수가 무음이 되고,
// 사용자는 낡은 목록을 최신으로 믿고 저장한다.
//
// 목록을 가리지 않아야 하므로 한 줄로 둔다. 배경 틴트는 error-tint 토큰이라
// error-tint 토큰을 새로 만들 필요가 없다(4개 테마에 값을 추가하는 비용을 피한다).
//
// **문구도 액션도 원인별로 갈리고, 액션은 없을 수 있다**([[ADR-114]] 결정 3). 429·온보딩 401·
// characterUnavailable 은 재시도가 통하지 않으므로 액션을 주지 않는다([[ADR-114]] 결정 2) —
// 눌러도 같은 실패인 버튼은 "고칠 수 있다"는 잘못된 신호다. 액션이 없어도 되는 이유는 자리에
// 있다: 배너 아래에 목록이 그대로 남아 있어 막다른 길이 아니다.
//
// **여기에 원인별 분기(switch)를 만들지 마라.** 포맷은 호출부가 `features/schedule-sync/format.ts`
// 의 formatStaleRosterError(error, place) 로 하고 이 컴포넌트는 그 결과(문구·액션)만 받는다 —
// molecule 이 ScheduleSyncError 라는 feature 어휘를 알면 계층 의존 방향이 뒤집힌다
// ([[ADR-094]] 결정 2).
//
// ── RN 으로 옮기며 바뀐 것 둘 ─────────────────────────────────────────────────────
//
// ① `<span>`/`<button>` → `Text`/`Pressable`, 줄을 잡는 것은 `flex-row` 다.
// ② 액션 라벨의 `hover:text-primary-hover` 를 뺐다(터치 기기에 hover 가 없다 — atoms 와 같은 규칙).
import { Pressable, View } from 'react-native'

import { AlertTriangleIcon } from '../../../lib/icons'
import { Text } from '../../atoms'

interface StaleBannerAction {
  label: string
  onClick: () => void
}

export interface StaleBannerProps {
  message: string
  /** 재시도가 실제로 통하는 실패에만 준다([[ADR-114]] 결정 2·3) — 429·401 에는 액션이 없다. */
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
