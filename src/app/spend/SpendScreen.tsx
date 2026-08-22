/**
 * 가계부 · 지출 — [[ADR-132]] 결정 12. **아직 껍데기다.**
 *
 * 정책은 [[ADR-166]] 이 정해 뒀다(2026-08-23, 이슈 #194) — 분류 다섯 · 통화 셋 · 환율은 사용자 값 ·
 * 한 행에 통화별 칸. 「셋으로 제시됐다」던 것 중 «메이플 포인트» 는 **분류가 아니라 통화**였다.
 *
 * **화면 자리만 아직 열려 있다** — 이 탭에 남는지 #187 캘린더에 흡수되는지는 그 이슈가 정한다.
 * 착수 전에 [[ADR-166]] 을 읽을 것.
 */

import { View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { UnderConstruction } from '../../components/molecules/UnderConstruction/UnderConstruction'

export function SpendScreen(): React.JSX.Element {
  return (
    <View testID="screen-Spend" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-semibold text-text">지출</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <UnderConstruction title="지출" description="아이템·버프 구매와 메이플 포인트 소비를 기록합니다." />
      </ScreenScroll>
    </View>
  )
}
