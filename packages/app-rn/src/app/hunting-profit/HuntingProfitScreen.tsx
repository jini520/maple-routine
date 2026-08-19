/** 가계부 · 사냥 수익 — [[ADR-132]] 결정 12. **아직 껍데기다.** */

import { View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { UnderConstruction } from '../../components/molecules/UnderConstruction/UnderConstruction'

export function HuntingProfitScreen(): React.JSX.Element {
  return (
    <View testID="screen-HuntingProfit" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-semibold text-text">사냥 수익</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <UnderConstruction title="사냥 수익" description="사냥으로 번 메소를 기록하는 자리입니다." />
      </ScreenScroll>
    </View>
  )
}
