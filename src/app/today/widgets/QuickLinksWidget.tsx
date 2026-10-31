/**
 * 빠른 이동. 사용자가 고른 화면을 칸 하나씩 여는 타일.
 *
 * 칸마다 갈 곳이 달라 타일 전체는 누를 수 없고 칸을 하나씩 누른다. 칸 아래 이름은 9px 짧은 이름이다. 한 줄에
 * 다섯 칸이면 칸 폭이 60px 안팎이라 그보다 크면 `캐릭터 관리` 가 한 줄에 안 들어간다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { PencilIcon, Text } from '../../../components/atoms'
import { QUICK_LINK_NAMES, QUICK_LINKS_PER_ROW } from '../../../features/quick-links/config'
import type { QuickLinkId } from '../../../types/quick-links'
import { QuickLinksSheet } from '../QuickLinksSheet'
import { QUICK_LINK_ICONS, useOpenQuickLink, useQuickLinkColors } from '../quick-links'
import type { WidgetProps } from './types'

function chunk(ids: readonly QuickLinkId[]): QuickLinkId[][] {
  const rows: QuickLinkId[][] = []
  for (let at = 0; at < ids.length; at += QUICK_LINKS_PER_ROW) rows.push(ids.slice(at, at + QUICK_LINKS_PER_ROW))
  return rows
}

export function QuickLinksWidget({ data }: WidgetProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const open = useOpenQuickLink()
  const { tint, ink } = useQuickLinkColors()

  return (
    <View testID="widget-quick-links" className="gap-2.5 p-3">
      <View className="flex-row items-center">
        <Text className="flex-1 text-11 font-bold text-text-muted">빠른 이동</Text>
        <Pressable
          role="button"
          aria-label="빠른 이동 편집"
          onPress={() => setEditing(true)}
          className="flex-row items-center gap-[3px]"
          hitSlop={8}
        >
          <PencilIcon className="h-3 w-3 text-text-muted" strokeWidth={2.2} aria-hidden />
          <Text className="text-xs text-text-muted">편집</Text>
        </Pressable>
      </View>
      <View className="gap-3">
        {chunk(data.quickLinks.ids).map((row, rowIndex) => (
          <View key={row[0]} testID={`quick-links-row-${rowIndex}`} className="flex-row">
            {row.map((id) => {
              const Icon = QUICK_LINK_ICONS[id]
              return (
                <Pressable
                  key={id}
                  role="button"
                  aria-label={QUICK_LINK_NAMES[id].name}
                  onPress={() => open(id)}
                  className="w-1/5 items-center gap-[5px]"
                >
                  <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: tint }}>
                    <Icon color={ink} size={21} strokeWidth={1.9} aria-hidden />
                  </View>
                  <Text className="text-9 text-text-muted" numberOfLines={1}>
                    {QUICK_LINK_NAMES[id].short}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
      {editing && <QuickLinksSheet config={data.quickLinks} onClose={() => setEditing(false)} />}
    </View>
  )
}
