/**
 * **고르는 갈래**의 폼 — 컨텐츠 · 이벤트·BM · 버프.
 *
 * ## 고르면 채워진다
 *
 * 사용자가 준 항목에 **전부 가격이 붙어 있다**. 그래서 이 갈래들에는 금액 칸이 없고, 고르면 단가가
 * 그대로 금액이 되며 수량만 조절한다. 곱셈은 **앱이 한다** — 사용자가 대신하면 «몇 포인트 썼나» 를
 * 나중에 되물을 수 없다(정정 1 ③).
 *
 * ## 두 단계다 (사용자 지정 2026-08-25)
 *
 * ① 묶음별 **대표**를 고른다(하이마운틴 · 몬스터 파크 …). ② 대표가 여러 갈래를 품으면 그 안에서
 * 고른다 — **단계**(1·2단계)와 **형태**(경험치·솔 에르다). `choice` 가 «지금 어느 단계인가» 를
 * 든다: `null` 이면 목록이 서고, 있으면 그 안이 선다.
 */
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { formatMesoCompact } from '../../../lib/cashbook/meso-compact'
import { spendIconOf } from '../../../lib/assets/asset-lookup'
import {
  findSpendChoice,
  pointToMeso,
  spendGroupsOf,
  type SpendCatalogChoice,
  type SpendCatalogItem,
} from '../../../lib/cashbook/spend-catalog'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { FieldRow, QuantityStepper } from '../sheet-fields'
import {
  CategoryChips,
  CharacterRow,
  RateRow,
  SaveRow,
  SpendHeader,
  type SpendFormProps,
} from './form-shared'
import { useSpendSubmit } from './use-spend-submit'

/**
 * 타일에 적는 값 — **단위를 붙이고, 단계가 여럿이면 나란히 적는다.**
 *
 * 단위를 붙이는 이유는 갈래 하나 안에서 통화가 갈리는 곳이 있어서다(「버프」의 영약은 메소,
 * 보약은 메포 —). **메소만 줄여 적는다** — 메포는 200~50,000 이라 그대로가
 * 읽히지만 메소는 백만 단위라 1/3 폭 타일에서 잘린다.
 */
function tilePriceLabel(items: readonly SpendCatalogItem[]): string {
  const first = items[0]
  if (first === undefined) return ''
  const numbers = items.map((item) =>
    item.currency === 'point' ? item.unitPrice.toLocaleString() : formatMesoCompact(item.unitPrice),
  )
  return `${numbers.join(' | ')} ${first.currency === 'point' ? '메포' : '메소'}`
}

/**
 * 타일 그림의 한 변 — 자리마다 다르다.
 *
 * **타일 왼쪽**(기본)은 이름 두 줄(≈32)보다 낮으면 높이를 안 건드린다. **이름 옆**(에픽던전 셋)은
 * 이름 한 줄(≈16)과 나란히 서므로 더 작아야 그 줄이 안 두꺼워진다.
 */
const TILE_ICON_SIZE = 24
const TITLE_ICON_SIZE = 18

function ItemTile(props: {
  label: string
  /** 값이 하나로 정해지는 칸만 가격을 적는다 — 단계가 여럿이면 단계마다 값이 달라 못 적는다. */
  price: string | null
  selected: boolean
  /** 안 열린 묶음의 타일 — 흐리고 **안 눌린다**. */
  disabled?: boolean
  onPress: () => void
}): React.JSX.Element {
  const icon = spendIconOf(props.label)
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      disabled={props.disabled}
      onPress={props.onPress}
      className={`w-1/3 p-1 ${props.disabled === true ? 'opacity-40' : ''}`}
    >
      {/*
        **`h-full` 을 안 쓴다.** 부모(`Pressable`)의 높이가 내용에서 나오는데 거기에 백분율 높이를
        걸면 그 값이 위쪽의 늘어난 상자에서 풀려, 타일 하나가 목록 높이를 통째로 먹는다
        (iOS 실측 2026-08-25). 한 줄 안의 높이는 `flex-1` 이 맞춘다.

        **그림 자리는 둘이다** — 기본은 타일 왼쪽 끝이고(위에 얹으면 그림
        있는 타일만 한 층 커진다), **에픽던전 셋만 이름 바로 옆**이다. 어느 쪽인지는 `spendIconOf`
        가 든다.
      */}
      <View
        className={`flex-1 flex-row items-center gap-1.5 rounded-xl border px-2 py-2.5 ${
          props.selected ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
        }`}
      >
        {icon !== null && !icon.beside && (
          // 아이템 아이콘은 **원본 비율 그대로** 둔다 — 상자에 맞춰 늘리면 도트가 뭉갠다.
          <Image
            testID={`spend-tile-icon-${props.label}`}
            source={icon.ref}
            resizeMode="contain"
            style={{ width: TILE_ICON_SIZE, height: TILE_ICON_SIZE }}
          />
        )}
        {/* 글자가 남은 폭을 갖는다 — `min-w-0` 이 없으면 긴 이름이 그림을 밀어낸다. */}
        <View className="min-w-0 flex-1 items-center gap-1">
          <View className="w-full flex-row items-center justify-center gap-1">
            {icon !== null && icon.beside && (
              <Image
                testID={`spend-tile-icon-${props.label}`}
                source={icon.ref}
                resizeMode="contain"
                style={{ width: TITLE_ICON_SIZE, height: TITLE_ICON_SIZE }}
              />
            )}
            {/* `shrink` 가 없으면 긴 이름이 그림을 타일 밖으로 밀어낸다. */}
            <Text numberOfLines={2} className="shrink text-center text-11 leading-4 text-text">
              {props.label}
            </Text>
          </View>
          {props.price !== null && (
            // **한 줄로 못박는다.** 두 줄이 되면 그 타일만 키가 커지고, `items-stretch` 라 같은
            // 줄의 타일이 통째로 따라 커진다. 좁으면 글자를 줄여 맞춘다.
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className={`text-11 ${props.selected ? 'text-primary-ink' : 'text-text-muted'}`}
              style={TABULAR_NUMS}
            >
              {props.price}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}

export function CatalogForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  /**
   * **한 번만 되짚는다** — 이름만 카탈로그를 거친다. 「하이마운틴 2단계」 는
   * 행에서 한 글자지만 시트에서는 **대표와 단계 둘**이다. 못 찾으면 목록이 선다 — **시트가
   * 안 열리는 것보다 낫다.**
   */
  const [found] = useState(() =>
    props.editing === undefined
      ? null
      : findSpendChoice(props.editing.category, props.editing.item),
  )
  const [choice, setChoice] = useState<SpendCatalogChoice | null>(found?.choice ?? null)
  const [item, setItem] = useState<SpendCatalogItem | null>(found?.item ?? null)
  const [form, setForm] = useState<string | null>(props.editing?.form ?? null)
  const [quantity, setQuantity] = useState(props.editing?.quantity ?? 1)
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [rateText, setRateText] = useState(() => {
    const rate = props.editing?.pointPer100mMeso ?? props.lastPointRate
    return rate === null || rate === undefined ? '' : String(rate)
  })
  const { saving, submit, remove } = useSpendSubmit(props)

  const groups = spendGroupsOf(props.category)
  const forms = choice?.items[0]?.forms ?? []
  /** 단계가 여럿일 때만 ②에 단계 줄이 선다 — 하나뿐이면 고를 것이 없다. */
  const tiers = choice !== null && choice.items.length > 1 ? choice.items : []
  // 형태가 있으면 **고르기 전에는 저장할 수 없다** — 안 고르고 저장하면 그 행은 «어느 쪽인지
  // 모르는 행» 이 되고, 그것은 칸을 더한 뜻을 없앤다.
  const formMissing = forms.length > 0 && form === null
  /**
   * 단계를 고르기 전에도 **대표가 아는 것** — 한 대표 안의 단계들은 단위도
   * 통화도 같다. 그래서 수량과 시세는 «무엇을 골랐나» 를 안 기다려도 된다.
   */
  const scope = item ?? choice?.items[0] ?? null

  const currency = scope?.currency ?? 'meso'
  const usesPoint = currency === 'point'
  const typedRate = Number(rateText)
  const rate = usesPoint && rateText !== '' && Number.isFinite(typedRate) ? typedRate : null
  const amount = (item?.unitPrice ?? 0) * quantity
  const totalMeso = usesPoint ? pointToMeso(amount, rate ?? 0) : amount
  // **메소로 셀 수 없는 상태.** 시세 줄의 빨간 `*` 와 꺼진 저장 버튼이 그 사실을 말한다
  // (가 큰 숫자 밑의 문구를 걷었다).
  const blocked = usesPoint && (rate === null || rate <= 0)
  const canSave = item !== null && !formMissing && !blocked

  /** ① 대표를 고른다. 갈래가 하나뿐이면 **그 자리에서 항목까지 정해진다.** */
  function selectChoice(next: SpendCatalogChoice): void {
    setChoice(next)
    setItem(next.items.length === 1 ? next.items[0] : null)
    // 형태는 있어도 **기본값을 안 고른다** — 앱이 «경험치였겠지» 라고 정하면 그것이 추정이 된다.
    setForm(null)
    setQuantity(1)
    props.onScrollKeyChange(next.label)
  }

  /** ② 그 안의 단계를 고른다. */
  function selectItem(next: SpendCatalogItem): void {
    setItem(next)
    setQuantity(1)
  }

  /** 목록으로 돌아간다. */
  function clearChoice(): void {
    setChoice(null)
    setItem(null)
    setForm(null)
    setQuantity(1)
    props.onScrollKeyChange('')
  }

  /**
   * 수정 모드의 머리 — **고른 것**을 적는다. 카탈로그가 그 항목을 못 찾으면
   * (참조표가 갈렸다) 기록에 적힌 이름을 그대로 쓴다.
   */
  const title = editing
    ? (choice?.label ?? props.editing?.item ?? props.category)
    : choice === null
      ? '지출 추가'
      : choice.label

  return (
    <>
      <SpendHeader
        title={title}
        dateKey={props.dateKey}
        onDateChange={props.onDateChange}
        // 수정 모드에는 되돌아갈 곳이 없다(고른 것을 못 바꾼다) — 화살촉도 없다.
        onBack={choice === null || editing ? undefined : clearChoice}
      />
      {!editing && choice === null && (
        <CategoryChips selected={props.category} onSelect={props.onSelectCategory} />
      )}

      {choice === null && !editing ? (
        // **여기에 스크롤을 두지 않는다.** 시트 껍데기가 이미 `BottomSheetScrollView` 이고 높이도
        // «내용만큼, 82% 를 상한으로» 다. 안쪽에 또 두면 중첩 스크롤이 되어 손가락이 어느 쪽을
        // 미는지 갈리고, 무엇보다 **목록이 상한선에서 잘려** 「더 있는지」가 안 보였다.
        <View className="gap-1">
          {groups.map((group) => (
            <View key={group.group} className="gap-1 pb-2">
              {/*
                **안 열린 묶음은 지우지 않고 흐리게 둔다**(사용자 선택).
                기간제 이벤트는 열릴 때만 있는 것이라 숨기면 «그런 것이 있었지» 를 기억할 자리가
                사라진다. 자리는 남기고 **못 고르게** 한다.
              */}
              <View className="flex-row items-center gap-1.5">
                <Text className="text-11 text-text-disabled">{group.group}</Text>
                {!group.active && (
                  <Text
                    testID={`spend-sheet-closed-${group.group}`}
                    className="text-11 text-text-disabled"
                  >
                    · 이벤트 기간이 아닙니다
                  </Text>
                )}
              </View>
              {/* 퍼센트 폭과 `gap` 을 섞으면 마지막 칸이 밀린다 — 간격은 자식 패딩이 만든다. */}
              <View className="-mx-1 flex-row flex-wrap">
                {group.choices.map((each) => (
                  <ItemTile
                    key={each.label}
                    label={each.label}
                    // 단계가 여럿이면 **나란히** 적는다 — `7,500 | 30,000 메포`.
                    price={tilePriceLabel(each.items)}
                    selected={false}
                    disabled={!group.active}
                    onPress={() => selectChoice(each)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        // 고른 뒤 — 라벨–값 줄들이 서고 **합계가 저장 바로 위**에 선다.
        <>
          <CharacterRow characters={props.characters} selected={ocid} onSelect={setOcid} />

          {forms.length > 0 && (
            // 형태는 **기본값을 안 고른다** — 앱이 «경험치였겠지» 라고 정하면 그것이 추정이 된다.
            <FieldRow label="형태">
              <Segment options={forms} selected={form} onSelect={setForm} />
            </FieldRow>
          )}

          {tiers.length > 0 && (
            <FieldRow label="단계">
              <Segment
                options={tiers.map((each) => each.tier ?? each.name)}
                selected={item === null ? null : (item.tier ?? item.name)}
                onSelect={(label) => {
                  const next = tiers.find((each) => (each.tier ?? each.name) === label)
                  if (next !== undefined) selectItem(next)
                }}
              />
            </FieldRow>
          )}

          {scope !== null && scope.maxQuantity !== 1 && (
            /*
             * 단위·상한은 **대표가 안다** — 단계를 고르기 전에도 선다. **상한이 1이면 안 세운다**
             * : 오르내릴 자리가 없는 스테퍼는 «조절할 수 있다» 는 거짓말이다.
             */
            <FieldRow label="수량">
              <QuantityStepper
                value={quantity}
                max={scope.maxQuantity}
                onChange={setQuantity}
                testID="spend-sheet-quantity"
              />
            </FieldRow>
          )}

          {item?.limit !== undefined && (
            // **적어만 두고 세지 않는다**. 몬스터 파크 한도는 축이 셋이라
            // 앱이 하나를 골라 수량을 막으면 그 고름이 곧 추정이 된다.
            <Text
              testID="spend-sheet-limit"
              className="-mt-1 text-11 leading-4 text-text-disabled"
            >
              한도 · {item.limit}
            </Text>
          )}

          {usesPoint && <RateRow value={rateText} onChange={setRateText} valid={rate !== null} />}

          {scope !== null && (
            /*
             * 목록 갈래의 큰 숫자는 **못 친다** — 단가 × 수량이라 앱이 센다. 단계를 고르기 전에도
             * **0 으로 선다**(사용자 지정): 단가를 아직 모를 뿐 셀 자리는 이미 있다.
             *
             * **합계는 언제나 메소다**(사용자 지정 2026-08-26) — 메포로 사는 항목이어도 그렇다.
             * 실제로 내는 메포는 밑의 힌트가 든다.
             */
            <AmountFigure
              value={totalMeso}
              unit="메소"
              testID="spend-sheet-amount"
            />
          )}
        </>
      )}

      {/* **타일 격자에만 저장이 없다** — 거기엔 셀 자리 자체가 없다. */}
      <SaveRow
        showSave={choice !== null || editing}
        editing={editing}
        canSave={canSave}
        saving={saving}
        onSave={() =>
          void submit({
            ocid,
            spentOn: props.dateKey,
            category: props.category,
            item: item?.name ?? null,
            form,
            // 종류는 「아이템 구매」의 것이다 — 여기서는 `null` 이라
            // «장비를 산 컨텐츠 지출» 같은 행이 생기지 않는다.
            itemKind: null,
            quantity,
            mesoAmount: currency === 'meso' ? amount : null,
            tariffMeso: null,
            pointAmount: currency === 'point' ? amount : null,
            pointPer100mMeso: currency === 'point' ? rate : null,
            cashAmount: null,
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
