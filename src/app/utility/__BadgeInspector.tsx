// 배지 감사용 임시 화면. 감사가 끝나면 지운다.
//
// `Badge` 밖에 남은 캡슐 11곳을 크기 6가지로 묶어 원본 클래스 그대로 그린다. 각 줄 오른쪽에
// `Badge` 의 default 를 나란히 놓아 얼마나 갈리는지 보이게 한다.
import { Pressable, View } from 'react-native'

import { Badge } from '../../components/atoms/Badge/Badge'
import { Card } from '../../components/atoms/Card/Card'
import { Text } from '../../components/atoms/Text/Text'
import { ValuableDropBadge } from '../../components/molecules/ValuableDropBadge/ValuableDropBadge'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ArrowUpIcon, ChevronDownIcon, RefreshCwIcon, UsersIcon } from '../../lib/icons'
import { TABULAR_NUMS } from '../../lib/text-styles'

function Row(props: {
  tag: string
  box: string
  count: string
  why: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-2 border-b border-border py-3">
      <View className="flex-row flex-wrap items-center gap-2">
        {props.children}
        <Text className="text-11 text-text-muted">↔</Text>
        <Badge variant="muted">Badge</Badge>
      </View>
      <View>
        <Text className="text-11 font-semibold text-text">
          {props.tag} · {props.box}
        </Text>
        <Text className="text-11 text-text-muted">
          {props.count} · {props.why}
        </Text>
      </View>
    </View>
  )
}

export function BadgeInspector(): React.JSX.Element {
  return (
    <View testID="screen-Utility" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-semibold text-text">Badge 밖 캡슐</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-3 px-4 pb-8">

          <Card className="gap-1 px-4 py-3">
            <Text className="text-sm font-bold text-text">Badge 안 — 크기 둘</Text>
            <Text className="pb-1 text-11 text-text-muted">56곳이 이 둘을 쓴다</Text>
            <View className="flex-row flex-wrap items-center gap-2 py-2">
              <Badge variant="secondary">완료</Badge>
              <Badge variant="muted">진행 불가</Badge>
              <Badge variant="익스트림">익스트림</Badge>
              <Badge variant="outline">v1.0.7</Badge>
              <Badge variant="하드" size="mini">하드</Badge>
              <Badge variant="secondary" size="mini" weight="bold">CLEAR</Badge>
            </View>
            <Text className="text-11 text-text-muted">
              난이도는 글자가 10px 인데도 바깥 높이는 20px 로 같다
            </Text>
          </Card>

          <Card className="gap-1 px-4 py-3">
            <Text className="text-sm font-bold text-text">Badge 밖 — 크기 여섯 · 11곳</Text>
            <Text className="pb-1 text-11 text-text-muted">
              오른쪽 회색이 Badge default 다. 견줘 보면 얼마나 갈리는지 보인다
            </Text>

            <Row tag="① px-2 py-1 · 12px" box="BossScreen:140" count="1곳" why="아이콘 + 글자">
              <View className="flex-row items-center gap-1 rounded-full bg-surface-2 px-2 py-1">
                <UsersIcon className="h-3 w-3 text-text" strokeWidth={2} aria-hidden />
                <Text className="text-xs font-semibold text-text">2인</Text>
              </View>
            </Row>

            <Row tag="② px-2.5 py-1 · 11px" box="AccordionBody:125·126" count="1곳" why="아이콘 Pressable">
              <Pressable className="flex-row items-center gap-1.5 rounded-full bg-error-tint px-2.5 py-1">
                <RefreshCwIcon className="h-3 w-3 text-error-ink" strokeWidth={2} aria-hidden />
                <Text className="text-11 font-semibold text-error-ink">다시 시도</Text>
              </Pressable>
            </Row>

            <Row
              tag="③ h-5 px-2 · 11px"
              box="BossProfitBossRow:264 · CharacterAccordion:370 · AccordionBody:160"
              count="3곳"
              why="밖에 있을 근거가 코드에 없다 — 넘길 수 있는 자리"
            >
              <View className="h-5 flex-row items-center rounded-full bg-primary-tint px-2">
                <Text
                  className="text-11 font-bold leading-none text-primary-ink"
                  style={TABULAR_NUMS}
                >
                  아이템 +12억
                </Text>
              </View>
            </Row>

            <Row tag="④ h-5 px-1.5 · 11px" box="HeadlineChips:84·190" count="2곳" why="아이콘 + h-6 라벨행">
              <View className="h-5 flex-row items-center gap-0.5 rounded-full bg-primary-tint px-1.5">
                <ArrowUpIcon className="h-2.5 w-2.5 text-primary-ink" strokeWidth={3} aria-hidden />
                <Text
                  className="text-11 font-bold leading-none text-primary-ink"
                  style={TABULAR_NUMS}
                >
                  12.4%
                </Text>
              </View>
            </Row>

            <Row
              tag="⑤ h-6 px-2.5 · 11px"
              box="BossProfitBossRow:68 · BossProfitScreen:457"
              count="2곳"
              why="아이콘 스택과 높이를 맞춘다 ([[ADR-049]])"
            >
              <View className="h-6 flex-row items-center rounded-full border border-dashed border-primary bg-primary-tint px-2.5">
                <Text className="text-11 font-bold text-primary-ink">＋ 드롭 추가</Text>
              </View>
              <View className="h-6 flex-row items-center gap-0.5 rounded-full border border-border px-2.5">
                <Text className="text-11 font-semibold text-text-muted">자세히 보기</Text>
                <ChevronDownIcon className="h-3 w-3 text-text-muted" strokeWidth={2} aria-hidden />
              </View>
            </Row>

            <Row
              tag="⑥ py-0.5 pl-1.5 pr-2 · 10px"
              box="ValuableDropBadge"
              count="1곳"
              why="아이콘 스택 · 좌우 비대칭"
            >
              <ValuableDropBadge
                label="고가 드롭"
                drops={[{ category: 'equipment', itemName: '데스티니 링', quantity: 1 }]}
              />
            </Row>
          </Card>

        </View>
      </ScreenScroll>
    </View>
  )
}
