/**
 * 지출 기록 시트의 껍데기. 갈래가 안 바꾸는 것만 여기 있다.
 *
 * 시트 상자와 지금 어느 갈래인가 하나뿐이고, 머리줄부터 저장까지는 갈래별 폼(`spend/`)이 든다.
 * 머리줄과 칩이 서는 자리가 갈래마다 달라서다. 갈래를 옮기면 폼이 언마운트되므로 고른 값이 함께
 * 사라진다.
 *
 * **자기가 어느 갈래인지 모른다.** 갈래는 펼침판이 시트 밖에서 갈랐고 이 시트는 지출이라는 사실조차
 * 프롭으로 안 받는다. 애초에 지출만 그리는 컴포넌트다.
 *
 * 날짜는 머리에 적기만 하고 여기서 안 바꾼다. 캘린더에서 칸을 눌러 고르는 것이 이 시트를 여는
 * 경로다.
 *
 * @see docs/features/cashbook.md 정책
 */
import { useState } from 'react'
import { View } from 'react-native'

import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { SPEND_CATEGORIES, type SpendCategory, type SpendRecord } from '../../storage/spend'
import { CatalogForm } from './spend/CatalogForm'
import { EtcForm } from './spend/EtcForm'
import { ItemBuyForm } from './spend/ItemBuyForm'
import type { SpendFormProps } from './spend/form-shared'

export type { SpendDraft } from './spend/form-shared'

export interface SpendSheetProps {
  /** 어느 날에 적히나. 캘린더에서 고른 날이다. */
  dateKey: string
  /**
   * 고를 수 있는 캐릭터. 화면이 읽어서 넘긴다(시트는 `storage/` 를 모른다).
   * 비어 있으면 고르개에 선택 안함 하나만 선다.
   */
  characters: ReadonlyArray<{ ocid: string; name: string }>
  /**
   * 고칠 기록. 있으면 **수정 모드**다. 머리와 버튼 글자가 갈리고 삭제가 선다.
   * 화면을 따로 만들지 않는 이유는 **입력 규칙이 한 벌이어야** 하기 때문이다.
   */
  editing?: SpendRecord
  onDelete?: () => void | Promise<void>
  /**
   * 마지막으로 쓴 메소마켓 시세. 필수 칸이 매번 비어 있으면 입력이 막히므로
   * 기억한다 가 여기서 결정적이다. `null` 이면 아직 한 번도 안 넣었다는 뜻이다.
   */
  lastPointRate: number | null
  /** 던지면 **안 닫는다**. 친 것을 잃지 않는다. 실패를 말하는 것은 화면 몫이다(토스트). */
  onSave: SpendFormProps['onSave']
  onClose: () => void
}

export function SpendSheet(props: SpendSheetProps): React.JSX.Element {
  const [category, setCategory] = useState<SpendCategory>(
    props.editing?.category ?? SPEND_CATEGORIES[0],
  )
  /**
   * 스크롤을 되돌릴 열쇠. 목록 갈래가 단계를 오갈 때 채운다. 갈래가 바뀌거나 단계를 오가면
   * 내용이 통째로 갈리므로 **밀린 자리에서 시작하면 안 된다.**
   */
  const [scrollKey, setScrollKey] = useState('')
  /**
   * **어느 날에 적히나**. 시트를 연 날로 시작하고 머리에서 바꾼다.
   *
   * 갈래 폼은 `key={category}` 로만 다시 심기므로, 날짜를 바꿔도 **친 것이 안 사라진다**.
   */
  const [dateKey, setDateKey] = useState(props.dateKey)

  function selectCategory(next: SpendCategory): void {
    setCategory(next)
    setScrollKey('')
  }

  const formProps: SpendFormProps = {
    dateKey,
    characters: props.characters,
    category,
    onSelectCategory: selectCategory,
    editing: props.editing,
    onDelete: props.onDelete,
    lastPointRate: props.lastPointRate,
    onSave: props.onSave,
    onClose: props.onClose,
    onScrollKeyChange: setScrollKey,
    onDateChange: setDateKey,
  }

  return (
    <BottomSheet
      testId="spend-sheet"
      onClose={props.onClose}
      resetScrollKey={`${category}|${scrollKey}`}
    >
      <View className="gap-3 px-4 pb-2">
        {/* **`key` 가 곧 갈래를 옮기면 값이 사라진다** 다. 갈래가 바뀌면
            리액트가 폼을 새로 심는다. 지울 것을 손으로 세지 않는다. */}
        <SpendForm key={category} category={category} formProps={formProps} />
      </View>
    </BottomSheet>
  )
}

/** 갈래 하나에 폼 하나. 고르는 자리는 여기 하나뿐이다. */
function SpendForm(props: {
  category: SpendCategory
  formProps: SpendFormProps
}): React.JSX.Element {
  if (props.category === '아이템 구매') return <ItemBuyForm {...props.formProps} />
  if (props.category === '기타') return <EtcForm {...props.formProps} />
  return <CatalogForm {...props.formProps} />
}
