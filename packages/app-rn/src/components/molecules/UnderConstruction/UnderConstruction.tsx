/**
 * 아직 만들지 않은 화면의 본문 — [[ADR-132]] 결정 12.
 *
 * ## «빈 상태» 가 아니다
 *
 * `EmptyState` 는 *"조건에 맞는 것이 없다"* 를 말하는 자리다(`error-resilience.md` 원칙 1·2). 여기는
 * 조건이 아니라 **구현이 없는** 것이라, 같은 그림을 쓰면 사용자가 «내 데이터가 없구나» 로 읽는다.
 * 그래서 문구를 명시적으로 «개발 진행중» 으로 두고 컴포넌트도 따로 둔다 — 화면이 완성되면 이
 * 컴포넌트를 지우는 것이 그 작업의 마지막 줄이 된다.
 *
 * ## 화면을 «만들어» 두는 이유
 *
 * 라우트만 만들고 화면을 비워 두면 [[ADR-128]] 4단계가 겪은 사고가 되풀이된다 — 타입도 테스트도
 * 통과한 채 **탭 하나만 자리표시자**로 뜨고, 그것을 실기기에서야 발견한다.
 */

import { Text, View } from 'react-native'

import { WrenchIcon } from '../../../lib/icons'

export interface UnderConstructionProps {
  /** 무엇을 만들고 있는지 — 화면 이름 그대로. */
  title: string
  /** 무엇이 들어올 자리인지 한 줄. 정해진 것만 적는다(지어내지 않는다). */
  description: string
}

export function UnderConstruction({ title, description }: UnderConstructionProps): React.JSX.Element {
  return (
    <View testID="under-construction" className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <View
        aria-hidden
        className="h-[84px] w-[84px] items-center justify-center rounded-full bg-primary-tint"
      >
        <WrenchIcon className="h-9 w-9 text-primary-ink" strokeWidth={1.75} />
      </View>
      <Text className="text-center text-base font-bold text-text">{title}</Text>
      <Text className="text-center text-sm text-text-muted">개발 진행중</Text>
      <Text className="text-center text-xs text-text-disabled">{description}</Text>
    </View>
  )
}
