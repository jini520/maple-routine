/**
 * 공지 상세 본문. 서버가 블록 배열로 준 것을 종류마다 다르게 그린다.
 *
 * **앱에 HTML 이 안 들어온다.** 넥슨 본문은 스마트에디터 HTML 이고 서버가 이 모양으로 바꿔
 * 주므로, 본문에 무엇이 들어 있든 태그가 여기 닿지 않는다. 모르는 종류는 서버 어댑터가 이미
 * 걸러 낸다.
 *
 * 이벤트와 캐시샵 본문은 **이미지 한 장뿐**이다(실측). 그래서 이미지가 곁들이가 아니라 본문
 * 자체이고, 가로를 꽉 채워 그린다.
 */
import { useState } from 'react'
import { Image, Linking, Pressable, ScrollView, View } from 'react-native'

import { ExternalLinkIcon, Text } from '../../components/atoms'
import type { NoticeBlock } from '../../types/notice'

/**
 * 원격 이미지 한 장. **비율을 받아 오기 전까지 자리를 잡아 둔다.**
 *
 * 넥슨 배너는 가로 876px 이고 세로가 제각각이라 상수로 못 박는다. `onLoad` 가 실제 크기를
 * 주므로 그때 비율을 고친다. 초기값이 없으면 높이가 0이라 이미지가 안 보이고, 너무 크게
 * 잡으면 로드 뒤에 화면이 크게 튄다.
 */
function NoticeImage(props: { src: string }): React.JSX.Element {
  const [ratio, setRatio] = useState(876 / 400)

  return (
    <Image
      testID="notice-image"
      accessibilityIgnoresInvertColors
      source={{ uri: props.src }}
      style={{ width: '100%', aspectRatio: ratio }}
      resizeMode="contain"
      onLoad={(event) => {
        const { width, height } = event.nativeEvent.source
        if (width > 0 && height > 0) setRatio(width / height)
      }}
    />
  )
}

/**
 * 표 한 장. **가로로 넘치면 표만 밀린다.**
 *
 * 페이지가 가로로 밀리면 안 된다. 넥슨 표는 칸이 넷을 넘기도 해서 좁은 기기에서 반드시 넘친다.
 */
function NoticeTable(props: { rows: string[][] }): React.JSX.Element {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View testID="notice-table" className="rounded-md border border-border">
        {props.rows.map((row, rowIndex) => (
          <View key={rowIndex} className={`flex-row ${rowIndex === 0 ? '' : 'border-t border-border'}`}>
            {row.map((cell, cellIndex) => (
              <View
                key={cellIndex}
                className={`w-36 p-2 ${cellIndex === 0 ? '' : 'border-l border-border'}`}
              >
                <Text className="text-xs leading-4 text-text">{cell}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

export function NoticeBlocks(props: { blocks: readonly NoticeBlock[] }): React.JSX.Element {
  return (
    <View className="gap-3" testID="notice-blocks">
      {props.blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            // 첫 블록이 아니면 위를 띄운다. 업데이트 공지는 제목 열여섯 개로 나뉜다.
            return (
              <Text
                key={index}
                className={`text-sm font-semibold text-text ${index === 0 ? '' : 'pt-2'}`}
              >
                {block.text}
              </Text>
            )
          case 'text':
            return (
              <Text key={index} className="text-sm leading-5 text-text">
                {block.text}
              </Text>
            )
          case 'image':
            return <NoticeImage key={index} src={block.src} />
          case 'link':
            return (
              <Pressable
                key={index}
                role="link"
                aria-label={block.text}
                onPress={() => {
                  void Linking.openURL(block.href).catch(() => undefined)
                }}
                className="flex-row items-center gap-1.5"
              >
                <Text className="text-sm text-primary">{block.text}</Text>
                <ExternalLinkIcon className="h-3.5 w-3.5 text-primary" strokeWidth={2} aria-hidden />
              </Pressable>
            )
          case 'table':
            return <NoticeTable key={index} rows={block.rows} />
        }
      })}
    </View>
  )
}
