/**
 * 가계부 · 지출 — [[ADR-132]] 결정 12. **아직 껍데기다.**
 *
 * 다룰 것이 셋으로 제시됐다(아이템 구매 · 버프 구매 · 메이플 포인트 소비). 그것이 이 화면 안의
 * 분류인지 더 아래 층인지는 [[ADR-132]] 열린 질문이라, 여기서 미리 정하지 않는다.
 */

import { Text, View } from 'react-native'

import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { UnderConstruction } from '../../components/molecules/UnderConstruction/UnderConstruction'

export function SpendScreen(): React.JSX.Element {
  return (
    <View testID="screen-Spend" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <Text className="text-lg font-semibold text-text">지출</Text>
          </PageHeader>
        }
      >
        <UnderConstruction title="지출" description="아이템·버프 구매와 메이플 포인트 소비를 기록합니다." />
      </ScreenScroll>
    </View>
  )
}
