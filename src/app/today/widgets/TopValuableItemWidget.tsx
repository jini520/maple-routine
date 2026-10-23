/**
 * 위젯 4. 이번 주에 기록된 판매가 중 가장 큰 것을 그리는 타일.
 *
 * `가장 비싼` 은 시세가 아니라 **기록된 판매가** 순위다. 앱에 아이템 시세표가 없어서 금액은 사용자가
 * 입력한 실제 판매가에서만 온다. **가격을 아직 안 적은 드롭은 순위에 없다.** 값을 모르는 것을 가장
 * 싼 것으로 단정하는 일이다.
 *
 * 미입력 건수는 여기서 말하지 않는다. 옆 타일(위젯 7)이 이미 들고 있다.
 *
 * 아이콘은 `card-inset` 칸 위에 앉는다. key 가 없거나 그림이 없으면 빈 칸이 폴백이다. 다른 아이템 그림을
 * 대신 세우면 그 아이템으로 읽힌다.
 */

import { Image, View } from 'react-native'

import { formatMesoShort } from '../../../lib/boss/boss-profit-delta'
import { dropItemIconOf } from '../../../lib/assets/asset-lookup'

import { Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { PricedDropView } from '../view-model'
import type { WidgetProps } from './types'

const EMPTY_NOTE = '가격이 입력된 아이템이 없습니다'
const TITLE = '이번 주 최고가'

const SLOT_PX = 40
const ICON_PX = 30

/** 아이콘 자리. 칸은 늘 서고 그림이 없으면 빈 칸이다 */
function IconSlot(props: { drop: PricedDropView | null }): React.JSX.Element {
  const url = props.drop === null ? null : dropItemIconOf(props.drop.itemKey)
  return (
    <View
      testID={props.drop !== null && url === null ? 'top-item-icon-fallback' : undefined}
      className="shrink-0 items-center justify-center rounded-[10px] bg-card-inset"
      style={{ width: SLOT_PX, height: SLOT_PX }}
    >
      {url !== null && props.drop !== null && (
        <Image
          testID="top-item-icon"
          accessibilityLabel={props.drop.itemName}
          source={url}
          resizeMode="contain"
          style={{ width: ICON_PX, height: ICON_PX }}
        />
      )}
      {props.drop === null && <Text className="text-sm font-bold text-text-disabled">―</Text>}
    </View>
  )
}

export function TopValuableItemWidget({ data }: WidgetProps): React.JSX.Element {
  const top = data.topItem

  if (top === null) {
    return (
      <View testID="widget-top-valuable-item" className="grow flex-row items-center gap-2.5 p-3">
        <IconSlot drop={null} />
        <Text testID="top-item-empty" numberOfLines={2} className="flex-1 text-11 text-text-muted">
          {EMPTY_NOTE}
        </Text>
      </View>
    )
  }

  return (
    <View testID="widget-top-valuable-item" className="grow flex-row items-center gap-2.5 p-3">
      <IconSlot drop={top} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-10 font-bold text-text-muted">{TITLE}</Text>
        <Text testID="top-item-amount" numberOfLines={1} className="text-text">
          <Text style={TABULAR_NUMS} className="text-15 font-bold text-text">
            {formatMesoShort(top.payoutMeso)}
          </Text>
          <Text className="text-11 font-semibold text-text-muted"> 메소</Text>
        </Text>
      </View>
    </View>
  )
}
