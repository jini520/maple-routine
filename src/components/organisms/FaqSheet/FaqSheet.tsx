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
      header={<Text className="text-base font-bold text-text">{props.title}</Text>}
    >
      {/* 좌우 16 을 **이 부품이 준다.** 껍데기의 스크롤 본문에는 좌우 여백이 없고(머리와 바닥
          줄만 갖는다) 자식이 자기 여백을 지는 것이 시트들의 관례다. 안 주면 글자가 화면 끝에
          붙고 문답 사이 선이 시트를 가로질러 통째로 갈라 놓는다. */}
      <View className="px-4 pb-2">
        {props.items.map((item, index) => (
          <View
            key={item.question}
            testID={`faq-item-${index}`}
            // 첫 문답 위에는 선이 없다. 머리 바로 아래라 선이 두 겹이 된다.
            className={index === 0 ? 'py-1' : 'border-t border-border py-3.5'}
          >
            <View className="flex-row items-start gap-2">
              <Text className="text-13 font-bold leading-5 text-primary-ink">Q</Text>
              <Text className="shrink text-sm font-semibold text-text">{item.question}</Text>
            </View>

            {/* 왼쪽 20 은 `Q` 표식과 그 사이 간격의 합이다. 답의 첫 글자가 질문의 첫 글자와 맞는다. */}
            <View className="mt-2 gap-2 pl-5">
              {item.answer.map((block) => (
                <Text key={block.text} className="text-13 text-text-muted">
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
