/**
 * 지출 기록 시트의 껍데기. 갈래가 안 바꾸는 것만 여기 있다.
 *
 * **갈래를 먼저 묻는다.** 안 골랐으면 카드 다섯이 서고, 고르면 그 갈래의 폼이 같은 시트에서
 * 열린다. 그래서 2차에는 갈래를 옮기는 자리가 없고, 바꾸는 일은 1차로 돌아가는 일이 된다.
 *
 * 시트 상자와 지금 어느 갈래인가 하나뿐이고, 머리줄부터 저장까지는 갈래별 폼(`spend/`)이 든다.
 * 머리줄이 서는 자리가 갈래마다 달라서다. 갈래를 옮기면 폼이 언마운트되므로 고른 값이 함께
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
import { CategoryPicker } from './CategoryPicker'
import { CatalogForm } from './spend/CatalogForm'
import { EtcForm } from './spend/EtcForm'
import { ItemBuyForm } from './spend/ItemBuyForm'
import { SaveRow, type SpendFormProps, type SpendSaveSlot } from './spend/form-shared'

export type { SpendDraft } from './spend/form-shared'

export interface SpendSheetProps {
  /** 어느 날에 적히나. 캘린더에서 고른 날이다. */
  dateKey: string
  /** 오늘. 머리의 날짜를 이 날 뒤로 못 옮긴다. 화면이 읽어서 넘긴다. */
  todayDateKey: string
  /**
   * 고를 수 있는 캐릭터. 화면이 읽어서 넘긴다(시트는 `storage/` 를 모른다).
   * 비어 있으면 고르개에 선택 안함 하나만 선다.
   */
  characters: ReadonlyArray<{ ocid: string; name: string }>
  /**
   * 고칠 기록. 있으면 수정 모드다. 머리와 버튼 글자가 갈리고 삭제가 선다. 화면을 따로 만들지
   * 않는 것은 입력 규칙이 한 벌이어야 하기 때문이다.
   */
  editing?: SpendRecord
  onDelete?: () => void | Promise<void>
  /**
   * 마지막으로 쓴 메소마켓 시세. 필수 칸이 매번 비어 있으면 입력이 막히므로 기억한다.
   * `null` 이면 아직 한 번도 안 넣었다는 뜻이다.
   */
  lastPointRate: number | null
  /** 던지면 **안 닫는다**. 친 것을 잃지 않는다. 실패를 말하는 것은 화면 몫이다(토스트). */
  onSave: SpendFormProps['onSave']
  onClose: () => void
}

/**
 * 갈래마다 그림 하나(전부 사용자 지정). 앞 셋은 그 갈래의 목록에 실제로 있는 항목이라
 * `ITEM_ICON_BY_LABEL` 이 같은 파일을 쓰지만, 저쪽은 항목 이름으로 찾고 여기는 갈래 이름으로
 * 찾으므로 **표를 합치지 않는다**. 합치면 항목 이름을 바꿀 때 카드 그림이 같이 사라진다.
 */
const CATEGORY_ICON_FILES: Record<SpendCategory, string> = {
  컨텐츠: 'monster_park_ticket.webp',
  '이벤트·BM': 'vip_sauna_ticket.webp',
  버프: 'seiram_elixir.webp',
  '아이템 구매': 'dark_boss_pendant.png',
  기타: 'meso.webp',
}

export function SpendSheet(props: SpendSheetProps): React.JSX.Element {
  /**
   * 무엇을 적나. `null` 이면 **아직 안 골랐다**이고 그때 이 시트는 갈래 고르개다.
   *
   * 수정으로 열면 기록이 정하므로 고르는 단계를 건너뛴다. 갈래를 바꾸면 그 기록은 다른 것이
   * 되고, 무엇이었는지는 제목이 이미 말한다.
   */
  const [category, setCategory] = useState<SpendCategory | null>(props.editing?.category ?? null)
  /**
   * 스크롤을 되돌릴 열쇠. 목록 갈래가 단계를 오갈 때 채운다. 갈래가 바뀌거나 단계를 오가면
   * 내용이 통째로 갈리므로 **밀린 자리에서 시작하면 안 된다.**
   */
  const [scrollKey, setScrollKey] = useState('')
  /**
   * 어느 날에 적히나. 시트를 연 날로 시작하고 머리에서 바꾼다.
   *
   * 갈래 폼은 `key={category}` 로만 다시 심기므로 날짜를 바꿔도 친 것이 안 사라진다.
   */
  const [dateKey, setDateKey] = useState(props.dateKey)
  /**
   * 시트 바닥에 서는 저장 줄의 값. 폼이 마운트 뒤에 올린다.
   *
   * **못 누르는 줄로 시작한다.** 폼이 올릴 때까지 비워 두면 시트가 열리는 도중에 바닥 줄이
   * 생기고, 그만큼 시트 키가 바뀌어 열리는 애니메이션 위에 크기 변화가 한 번 더 얹힌다.
   *
   * `showSave` 의 첫 값이 거짓인 것은 목록 갈래가 항목 격자로 열리기 때문이다. 직접 입력 둘은
   * 첫 렌더 직후에 참으로 올린다.
   */
  const [save, setSave] = useState<SpendSaveSlot>({
    showSave: false,
    editing: props.editing !== undefined,
    canSave: false,
    saving: false,
    onSave: () => {},
    onDelete: props.onDelete === undefined ? undefined : () => {},
  })

  /** 1차로 되돌아간다. 고르던 것은 폼과 함께 사라진다. */
  function clearCategory(): void {
    setCategory(null)
    setScrollKey('')
  }

  const formProps: SpendFormProps | null =
    category === null
      ? null
      : {
          setSave,
          dateKey,
          characters: props.characters,
          category,
          onBack: clearCategory,
          editing: props.editing,
          onDelete: props.onDelete,
          lastPointRate: props.lastPointRate,
          onSave: props.onSave,
          onClose: props.onClose,
          onScrollKeyChange: setScrollKey,
          onDateChange: setDateKey,
          todayDateKey: props.todayDateKey,
        }

  return (
    <BottomSheet
      testId="spend-sheet"
      label="지출 기록"
      onClose={props.onClose}
      resetScrollKey={`${category ?? ''}|${scrollKey}`}
      // 단계가 갈리면 시트 전체가 흐려졌다 돌아온다. 항목을 고르는 것도 단계다.
      stepKey={`${category ?? '갈래'}|${scrollKey}`}
      /*
       * **항목 격자에서도 바닥 영역을 그대로 잡는다**(사용자 지시). 버튼만 안 선다. 영역째
       * 걷으면 단계를 오갈 때 시트의 아랫부분이 그 높이만큼 늘었다 줄었다 한다.
       *
       * 1차에는 셀 것이 없어 바닥 줄 자체가 없다. 닫기는 내용 안에 선다.
       */
      footer={category === null ? undefined : <SaveRow {...save} />}
    >
      {category === null || formProps === null ? (
          <CategoryPicker
            title="지출 추가"
            categories={SPEND_CATEGORIES}
            iconFiles={CATEGORY_ICON_FILES}
            testIdPrefix="spend-sheet"
            onSelect={setCategory}
            onClose={props.onClose}
          />
      ) : (
        // 아래 여백을 안 붙인다. 바닥의 숨돌림은 껍데기가 한 값으로 낸다.
        <View className="gap-3 px-4">
          {/* `key` 가 곧 갈래를 옮기면 값이 사라진다 다. 1차를 거쳐 돌아오면 리액트가 폼을
              새로 심는다. 지울 것을 손으로 세지 않는다. */}
          <SpendForm key={category} category={category} formProps={formProps} />
        </View>
      )}
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
