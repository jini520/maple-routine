/**
 * 유틸리티 — [[ADR-132]] 결정 12. **아직 껍데기다.**
 *
 * 무엇이 들어오는지가 아직 정해지지 않았다([[ADR-132]] 열린 질문) — 그래서 설명도 «도구» 라는
 * 성격까지만 적는다. 지어내면 그 문구가 정해진 것처럼 읽힌다.
 */

import { View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { UnderConstruction } from '../../components/molecules/UnderConstruction/UnderConstruction'

export function UtilityScreen(): React.JSX.Element {
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
        <UnderConstruction title="유틸리티" description="메이플을 하며 쓰는 도구들이 이 자리에 들어옵니다." />
      </ScreenScroll>
    </View>
  )
}
