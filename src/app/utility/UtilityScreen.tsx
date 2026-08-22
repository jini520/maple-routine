/**
 * 유틸리티 — **도구 목록**이다([[ADR-168]] 결정 6).
 *
 * 껍데기였던 자리에 첫 도구가 들어왔다([[ADR-132]] 결정 12 가 *"화면은 실재한다"* 고 적어 둔 그
 * 자리다). 도구를 이 화면 **안의 카드**로 그리지 않고 하위 페이지로 미는 것이 결정이고, 그 값은
 * 공짜로 따라오는 전환 애니메이션과 iOS 가장자리 스와이프다([[ADR-120]] 결정 1·2·4 · [[ADR-167]]).
 *
 * **도구를 더할 때는 아래 카드를 형제로 하나 더 놓는다** — 그리고 `routes.ts` 한 줄,
 * `RootNavigator` 의 `STACK_SCREENS` 한 줄, `docs/features/utility.md`. 넷뿐이다.
 * 목록을 데이터 배열로 돌리지 않는 것은 아직 하나뿐이기 때문이고, 셋쯤 되면 그때 돌린다.
 */

import { Pressable, View } from 'react-native'

import { Card } from '../../components/atoms/Card/Card'
import { Text } from '../../components/atoms/Text/Text'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ChevronRightIcon, StoreIcon } from '../../lib/icons'
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
        <View className="gap-3 px-4 pb-4">
          {/* 경매장 아이콘인 것이 뜻이다 — 이 도구가 푸는 것은 «분배» 가 아니라 «경매장 수수료» 다. */}
          <Pressable role="button" onPress={() => navigation.navigate('UtilityItemSplit')}>
            <Card className="flex-row items-center gap-3 px-4 py-4">
              <StoreIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-text">아이템 분배 계산기</Text>
                <Text className="text-xs text-text-muted">
                  경매장 수수료를 거쳐도 모두가 같아지는 금액
                </Text>
              </View>
              <ChevronRightIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
            </Card>
          </Pressable>
        </View>
      </ScreenScroll>
    </View>
  )
}
