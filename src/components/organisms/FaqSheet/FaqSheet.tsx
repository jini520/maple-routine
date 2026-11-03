/**
 * 설명이 필요한 자리가 여는 공용 시트. 질문과 답을 **전부 펼친 채** 싣는다.
 *
 * 접고 펴는 장치를 두지 않는 이유는 **여는 사람이 이미 질문을 들고 왔기** 때문이다. 결산 줄을
 * 탭한 사람은 결산이 무엇인지 물은 것이고, 그 사람에게 목차부터 보이면 답까지 한 번 더 눌러야 한다.
 *
 * 높이는 껍데기가 정한다. 내용만큼 서고 화면의 82% 에서 멈춘 뒤 그 안에서 스크롤한다. FAQ 전용
 * 상한을 두지 않는 것은 같은 자리에서 올라오는 시트들이 저마다 다른 높이에서 멈추지 않게 하려는 것이다.
 *
 * @example
 * {열림 ? <FaqSheet title="스케줄러 결산" items={SETTLEMENT_FAQ} onClose={닫기} /> : null}
 * @see docs/features/today.md 결산 안내 줄
 */
import { View } from 'react-native'

import { Text } from '../../atoms'
import { BottomSheet } from '../BottomSheet/BottomSheet'

/**
 * 답 한 조각.
 *
 * 종류가 지금 하나인 것은 쓰는 FAQ 가 문단만 써서다. 배열 모양을 두는 것이 늘릴 자리이고,
 * 종류가 늘어도 호출부는 안 고친다.
 */
export type FaqBlock = { kind: 'paragraph'; text: string }

export interface FaqItem {
  question: string
  answer: FaqBlock[]
}

export interface FaqSheetProps {
  /** 머리에 서는 이름. **그 화면의 말로 쓴다.** `자주 묻는 질문` 은 무엇에 대한 설명인지를 안 말한다. */
  title: string
  items: readonly FaqItem[]
  onClose: () => void
}

export function FaqSheet(props: FaqSheetProps): React.JSX.Element {
  return (
    <BottomSheet
      testId="faq-sheet"
      label={props.title}
      onClose={props.onClose}
      // 껍데기 머리의 좌우 16 에 8 을 더해 아래 문답의 좌우 24 에 맞춘다.
      header={<Text className="px-2 text-base font-bold text-text">{props.title}</Text>}
    >
      {/* 좌우 24 를 **이 부품이 준다.** 껍데기의 스크롤 본문에는 좌우 여백이 없고 자식이 자기 여백을 진다. */}
      <View className="gap-6 px-6 pb-2 pt-2">
        {props.items.map((item, index) => (
          <View key={item.question} testID={`faq-item-${index}`}>
            <View className="flex-row items-start">
              {/* 칸 폭 20 이 아래 답의 `pl-5` 와 같아서 글자 크기 설정이 바뀌어도 질문과 답의 첫 글자가 맞는다. */}
              <Text className="w-5 text-base font-bold text-primary-ink">Q</Text>
              <Text className="shrink text-base font-bold text-text">{item.question}</Text>
            </View>

            <View className="mt-2 gap-2 pl-5">
              {item.answer.map((block) => (
                <Text key={block.text} className="text-sm text-text-muted">
                  {block.text}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  )
}
