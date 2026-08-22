/**
 * 유틸리티 — **도구 목록**이다([[ADR-168]] 결정 6).
 *
 * 껍데기였던 자리에 첫 도구가 들어왔다([[ADR-132]] 결정 12 가 *"화면은 실재한다"* 고 적어 둔 그
 * 자리다). 도구를 이 화면 **안의 카드**로 그리지 않고 하위 페이지로 미는 것이 결정이고, 그 값은
 * 공짜로 따라오는 전환 애니메이션과 iOS 가장자리 스와이프다([[ADR-120]] 결정 1·2·4 · [[ADR-167]]).
 *
 * 목록은 **2열 타일 격자**다(사용자 지정, 2026-08-23) — 이름만 있고 설명은 없다. 도구 이름이
 * 곧 설명이어야 한다는 뜻이고, 그렇지 않은 이름은 이름 쪽을 고칠 일이다. 타일은 **가로:세로 2:1** —
 * 담는 것이 아이콘 하나와 이름 한 줄뿐이라 정사각은 빈 자리가 더 컸다.
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
import { ITEM_SPLIT_TOOL_NAME } from './tool-names'

/**
 * 타일 이름 — **단어 단위로 줄바꿈한다**(사용자 지정, 2026-08-23).
 *
 * RN 의 `Text` 는 한글을 **글자 단위**로 끊는다(「판매 분배금 계 / 산기」). RN 에는 웹의
 * `word-break` 에 해당하는 스타일이 없으므로, 단어마다 `Text` 를 하나씩 두고 **flex 아이템으로
 * 감싼다** — 줄바꿈이 아이템 경계에서만 일어나므로 단어가 통째로 움직인다. `
` 을 박아 넣는
 * 방법도 있지만 그러면 넓은 화면에서도 끊긴다.
 *
 * **가운데 정렬**이다(사용자 지정, 2026-08-23) — 정렬은 `Text` 의 `text-center` 가 아니라 이 줄의
 * `justify-center` 가 한다. 글자가 단어별 flex 아이템이라 각 줄을 미는 것이 그쪽 축이기 때문이다.
 */
function TileLabel(props: { text: string }): React.JSX.Element {
  return (
    <View className="flex-1 flex-row flex-wrap justify-center gap-x-1">
      {props.text.split(' ').map((word, index) => (
        <Text key={`${word}-${index}`} className="text-sm font-semibold text-text">
          {word}
        </Text>
      ))}
    </View>
  )
}

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
            // 이름이 단어별 `Text` 로 쪼개져 있으므로(TileLabel) 접근성 이름은 여기서 한 벌로 준다 —
            // 그러지 않으면 스크린리더가 «판매» «분배금» «계산기» 를 따로 읽는다.
            aria-label={ITEM_SPLIT_TOOL_NAME}
            onPress={() => navigation.navigate('UtilityItemSplit')}
            className="w-[48%]"
          >
            {/* 가로:세로 = 2:1, 안은 «아이콘 → 이름» 가로 배치(사용자 지정, 2026-08-23).
                납작한 타일에는 세로 쌓기보다 가로가 맞는다 — 세로면 둘 다 눌려 보인다. */}
            <Card className="aspect-[2/1] flex-row items-center gap-3 px-4">
              <CalculatorIcon
                className="h-7 w-7 shrink-0 text-text-muted"
                strokeWidth={1.75}
                aria-hidden
              />
              <TileLabel text={ITEM_SPLIT_TOOL_NAME} />
            </Card>
          </Pressable>
        </View>
      </ScreenScroll>
    </View>
  )
}
