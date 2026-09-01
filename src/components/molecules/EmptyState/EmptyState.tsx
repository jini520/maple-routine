// "비어있음"을 표시하는 곳이 공통으로 쓰는 컴포넌트([[ADR-060]]). 원형 배지(컨텍스트 아이콘) +
// 제목 + 설명 + CTA 중앙 정렬이고, size 는 배지 크기·타이포·CTA 크기만 바꾼다.
//   page   — 캐릭터 미선택(화면 전체). 자체 박스 없이 화면이 감싼 중앙 영역을 채운다.
//   inline — 목록 자리에 들어가는 박스. 자체 카드 테두리를 가진다.
// "조회 불가"(확인 자체를 못 함)에는 이걸 쓰지 말 것 — UnavailableNotice 를 쓴다.
//
// ── RN 으로 옮기며 바뀐 것 넷 ─────────────────────────────────────────────────────
//
// ① `inline` 껍데기가 `Card` atom 이 됐다(`LoadingState` 와 같은 이유 — 그 세 유틸리티가 정확히
//    `Card` 의 것이다). `page` 는 껍데기가 없어 `View` 그대로다.
// ② 단풍잎 색이 **`fill-primary-ink` → `text-primary-ink` + `fill="currentColor"`** 로 바뀌었다.
//    `fill` 은 CSS 속성이라 RN style 에 없고, `react-native-svg` 는 색을 `Svg` 의 `color` 프롭에서
//    받는다(`lib/nativewind-interop.ts`). 그림과 색은 같고 통로만 다르다.
// ③ `space-y-1` → `gap-1`. NativeWind 에는 형제 선택자가 없어 `space-y-*` 가 없다.
// ④ `text-center` 가 상자에서 **각 글자로** 내려왔다(RN 은 `textAlign` 을 상속하지 않는다).
//
// **CTA 는 `Button` atom 을 쓰지 않는다** — 웹도 쓰지 않고, 두 크기의 여백이 `Button` 의 것과
// 다르다(page `px-5 py-2.5` / inline `px-4 py-2` vs Button `px-5 py-2.5`). atom 위에 여백 클래스를
// 덮어쓰면 **어느 쪽이 이기는지가 스타일시트 순서에 달리므로**(class 문자열 순서가 아니다) 조용히
// 갈릴 수 있다. 웹과 같은 자체 pill 로 둔다.
import { Pressable, View } from 'react-native'

import { Card, MapleLeaf, Text } from '../../atoms'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  /**
   * 목록 빈 상태는 무엇이 비었는지 알려주는 아이콘, 캐릭터 미선택(page)은 브랜드 마크 'leaf'.
   * 타입이 `LucideIcon` 이 아니라 "우리가 실제로 넘기는 두 prop"인 이유는 커스텀 아이콘도 받기
   * 위해서다([[ADR-066]] 결정 5) — `LucideIcon` 은 forwardRef 타입이라 평범한 함수 컴포넌트가
   * 대입되지 않는다. lucide 아이콘은 이 타입에 그대로 들어온다(`lib/icons.ts` 에서 가져올 것 —
   * 등록을 거치지 않으면 `className` 이 조용히 무시된다).
   */
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }> | 'leaf'
  title: string
  description?: string
  /** 문구가 지시하는 목적지가 앱 안에 있을 때만 준다 — 없으면 CTA를 만들지 않는다(ADR-060 결정 3). */
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
