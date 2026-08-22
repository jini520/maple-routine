/**
 * 유틸리티 — **도구 목록**이다([[ADR-168]] 결정 6).
 *
 * 껍데기였던 자리에 첫 도구가 들어왔다([[ADR-132]] 결정 12 가 *"화면은 실재한다"* 고 적어 둔 그
 * 자리다). 도구를 이 화면 **안의 카드**로 그리지 않고 하위 페이지로 미는 것이 결정이고, 그 값은
 * 공짜로 따라오는 전환 애니메이션과 iOS 가장자리 스와이프다([[ADR-120]] 결정 1·2·4 · [[ADR-167]]).
 *
 * 목록은 **2열 타일 격자**다(사용자 지정, 2026-08-23) — 이름만 있고 설명은 없다. 도구 이름이
 * 곧 설명이어야 한다는 뜻이고, 그렇지 않은 이름은 이름 쪽을 고칠 일이다.
 *
 * **도구를 더할 때는 아래 타일을 형제로 하나 더 놓는다** — 그리고 `routes.ts` 한 줄,
 * `RootNavigator` 의 `STACK_SCREENS` 한 줄, `docs/features/utility.md`. 넷뿐이다.
 * 목록을 데이터 배열로 돌리지 않는 것은 아직 하나뿐이기 때문이고, 셋쯤 되면 그때 돌린다.
 */

import { Pressable, View } from 'react-native'

import { Card } from '../../components/atoms/Card/Card'
import { Text } from '../../components/atoms/Text/Text'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { CalculatorIcon } from '../../lib/icons'
import { useScreenNavigation } from '../use-screen-navigation'

export function UtilityScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()

  return (
    <View testID="screen-Utility" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-semibold text-text">유틸리티</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* 2열 격자 — RN 에 CSS grid 가 없으므로 `flex-wrap` + 자식 폭이 열을 만든다. `w-[48%]` 는
            48+48+간격이 100% 안에 들어오는 값이고, 남는 여백을 `gap-3` 이 먹는다. */}
        <View className="flex-row flex-wrap gap-3 px-4 pb-4">
          <Pressable
            role="button"
            onPress={() => navigation.navigate('UtilityItemSplit')}
            className="w-[48%]"
          >
            <Card className="aspect-square items-center justify-center gap-3 px-3">
              <CalculatorIcon className="h-8 w-8 text-text-muted" strokeWidth={1.75} aria-hidden />
              <Text className="text-center text-sm font-semibold text-text">아이템 분배 계산기</Text>
            </Card>
          </Pressable>
        </View>
      </ScreenScroll>
    </View>
  )
}
