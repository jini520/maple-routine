/**
 * 아이템 구매 · 판매의 아이템 칸. 입력 카드 안 목록에서 고르거나 이름을 친다. 인벤토리 넣기와 같은 목록 · 찾기 규칙이지만
 * 목록에 없는 이름도 친 그대로 받는다. 목록에는 자주 쓰일 아이템 위주로만 들어 있기 때문이다.
 */
import { Image, Pressable } from 'react-native'

import { Text } from '../../components/atoms'
import { openInputCard } from '../../features/input-card/store'
import { catalogMatches, inventoryCatalog, type CatalogItem } from '../../features/inventory/catalog'
import { getAssetImage } from '../../lib/assets/asset-lookup'

/** @param props.onPick 목록의 한 줄을 고르면 그 줄 */
export function ItemPickField(props: {
  testID: string
  label: string
  placeholder: string
  picked: CatalogItem | null
  name: string
  onPick: (entry: CatalogItem) => void
  onType: (text: string) => void
}): React.JSX.Element {
  const icon = props.picked === null ? null : getAssetImage(props.picked.iconAssetId)
  const empty = props.name === ''
  return (
    <Pressable
      testID={props.testID}
      role="button"
      aria-label={props.label}
      onPress={() => {
        const catalog = inventoryCatalog()
        openInputCard({
          label: props.label,
          text: true,
          placeholder: props.placeholder,
          value: props.name,
          suggestions: {
            itemsOf: (draft) => catalogMatches(catalog, draft),
            onPick: (key) => {
              const entry = catalog.find((each) => each.key === key)
              if (entry !== undefined) props.onPick(entry)
            },
          },
          onConfirm: props.onType,
        })
      }}
      className="h-5 flex-1 flex-row items-center justify-end gap-1.5"
    >
      {icon !== null && <Image source={icon} style={{ width: 20, height: 20 }} resizeMode="contain" aria-hidden />}
      <Text numberOfLines={1} className={`shrink text-right text-sm ${empty ? 'text-text-disabled' : 'font-semibold text-text'}`}>
        {empty ? props.placeholder : props.name}
      </Text>
    </Pressable>
  )
}
