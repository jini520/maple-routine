// 실패를 표시하는 곳이 공통으로 쓰는 컴포넌트([[ADR-062]]). 아이콘 + 제목 + 설명 + 액션 중앙 정렬.
//
// 세 상태(조회 중 / 확정된 빈 상태 / 확인 불가·실패)는 항상 구분 가능해야 하므로([[ADR-060]]·
// [[ADR-061]], error-resilience.md 원칙 2) EmptyState와 디자인을 공유하지 않는다:
//   EmptyState        원형 배지 안 아이콘 · 브랜드색 · 액션은 목적지가 앱 안에 있을 때만
//   UnavailableNotice 단독 Info · 정보 톤(info-tint) · 액션 없음(고칠 수 없는 제약)
//   ErrorState        단독 AlertTriangle · 경고색 · **그 자리에 진행 경로가 하나 이상**(아래)
//
// **이 컴포넌트가 그려지는 자리는 원인과 무관하게 진행 경로를 하나 이상 갖는다**([[ADR-116]] 결정 4).
// 그 경로가 **이 컴포넌트의 `action` 일 필요는 없다** — 껍데기(모달의 `닫기`·`취소`)나 그 위에 덮이는
// 안내 모달([[ADR-116]] 결정 1)이 제공해도 된다. 그래서 `action` 은 옵셔널이다.
//
// **액션 없이 쓸 수 있는 조건은 하나뿐이다 — 그 자리에서 사용자가 앞으로 갈 수 있는 다른 수단이
// 실제로 있을 때.** 없으면 그 화면은 잠긴다. 온보딩 캐릭터 선택의 429가 정확히 그 사고였다(이슈 #176):
// 액션 없는 이 컴포넌트 + 고를 것이 없어 영구 비활성인 CTA + 라우트가 아닌 단계 구조라 조작 가능한
// 요소가 0개가 됐다. 지금까지 액션은 **원인별로** 정해졌고(401은 이것, 429는 저것) **자리 단위로
// 잠기는지는 아무도 보지 않았다** — 규칙을 자리 기준으로 세워 두면 원인이 하나 늘어도 같은 사고가
// 나지 않는다.
//
// **아이콘을 배지로 감싸지 않는다** — design-system.md "아이콘" 절의 *배경 없이 단독* 규칙을 그대로
// 따라 예외를 늘리지 않는다(빈 상태 배지가 그 예외다). 그 결과 배지 유무만으로 빈 상태와 즉시 갈려,
// 규칙 준수와 상태 구분이 같은 선택으로 해결된다.
//
// 자체 카드와 크기 변형을 두지 않는다 — 적용처가 모두 이미 껍데기 안이고(피커=모달 카드,
// 온보딩=페이지) 같은 크기를 쓴다. LoadingState를 이 두 자리에 씌우지 않는 것과 같은 판단([[ADR-061]]).
// 카드가 필요하거나 크기가 갈리는 자리가 생기면 그때 추가한다.
//
// ── RN 으로 옮기며 바뀐 것 셋 ─────────────────────────────────────────────────────
//
// ① `role="alert"` 은 그대로 남는다 — RN 의 `role` 이 같은 이름의 ARIA 값을 받는다(스크린리더에
//    즉시 알린다는 계약이 유지된다).
// ② `space-y-1` → `gap-1`, `text-center` 는 각 글자로(RN 은 `textAlign` 을 상속하지 않는다).
// ③ 재시도 버튼은 웹처럼 자체 pill 이다 — `Button` atom 의 여백(`px-5 py-2.5`)과 다르고
//    (`px-4 py-2 text-xs`), 덮어쓰기는 클래스 순서가 아니라 스타일시트 순서에 달려 조용히 갈린다.
import { Pressable, View } from 'react-native'

import { AlertTriangleIcon } from '../../../lib/icons'
import { Text } from '../../atoms/Text/Text'

interface ErrorStateAction {
  label: string
  onClick: () => void
}

export interface ErrorStateProps {
  title: string
  description?: string
  /**
   * 그 원인을 실제로 푸는 행동만 준다 — 401·429에 "다시 시도"를 주지 말 것([[ADR-062]] 결정 3,
   * [[ADR-114]] 결정 2). **생략하려면 위 계약대로 그 자리의 진행 경로를 다른 것이 제공해야 한다.**
   */
  action?: ErrorStateAction
}

export function ErrorState(props: ErrorStateProps): React.JSX.Element {
  return (
    <View
      testID="error-state"
      role="alert"
      className="min-h-[120px] flex-1 items-center justify-center gap-3 px-4"
    >
      <AlertTriangleIcon className="h-7 w-7 text-error-ink" strokeWidth={1.75} aria-hidden />

      <View className="gap-1">
        <Text testID="error-state-title" className="text-center text-sm font-semibold text-text">
          {props.title}
        </Text>
        {props.description !== undefined && (
          <Text
            testID="error-state-description"
            className="mx-auto max-w-[240px] text-center text-xs text-text-muted"
          >
            {props.description}
          </Text>
        )}
      </View>

      {props.action !== undefined && (
        // 재시도는 파괴적 동작이 아니라 진행 동작이라 primary다(삭제 버튼의 border-error text-error-ink 와 구분).
        <Pressable role="button" onPress={props.action.onClick} className="rounded-full bg-primary px-4 py-2">
          <Text className="text-xs font-semibold text-on-primary">{props.action.label}</Text>
        </Pressable>
      )}
    </View>
  )
}
