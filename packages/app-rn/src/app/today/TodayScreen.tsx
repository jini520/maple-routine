/**
 * 첫 화면 「today」 — [[ADR-132]] 결정 7·12. **아직 껍데기다.**
 *
 * 계획은 ADR 에 있다: 오늘 할 일 진행률 · 이번 주 보스 · 이번 주 수익(증감 칩) · 사냥 타이머 ·
 * 초기화까지 남은 시간. 전부 기존 스토어에서 나오는 값이라 새 API 도 새 계산도 없다.
 *
 * **내용이 붙을 때 함께 처리해야 하는 것**(결정 8): 이 화면은 스스로 동기화를 트리거하고 TTL 정책을
 * 공유한다 — 그러면 `schedule-sync` 에 **단일 비행**이 필요해진다(진행 중인 호출이 있으면 그
 * 프라미스를 함께 기다린다). 지금은 부르는 주체가 없어 재현되지 않을 뿐이고, 사라진 문제가 아니다.
 */

import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { UnderConstruction } from '../../components/molecules/UnderConstruction/UnderConstruction'
import { Text, View } from 'react-native'

export function TodayScreen(): React.JSX.Element {
  return (
    <View testID="screen-Today" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <Text className="text-lg font-semibold text-text">today</Text>
          </PageHeader>
        }
      >
        <UnderConstruction
          title="오늘 현황"
          description="오늘 할 일과 이번 주 수익을 한 화면에 모읍니다."
        />
      </ScreenScroll>
    </View>
  )
}
