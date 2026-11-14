/**
 * 주간 보스 수입 이전 폼. 다른 계정 캐릭터의 메소를 경매장으로 옮길 때 빠진 수수료를 보내는 캐릭터의 `기타` 지출로 적는다.
 *
 * 수수료율은 메소를 받는 캐릭터의 MVP 등급이다. 금액은 사용자가 치고, 체크 박스는 그 주 결정석 몫을 채울 뿐이다.
 */
import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'

import { Text } from '../../../components/atoms'
import { CheckBox } from '../../../components/atoms/CheckBox/CheckBox'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { FeeRow } from '../../../components/organisms/FeeRow/FeeRow'
import { transferFeeMeso } from '../../../lib/cashbook/boss-income-transfer'
import { spendCategoryNameOf } from '../../../lib/cashbook/categories'
import type { FeePercent } from '../../../lib/cashbook/item-split'
import { useSpendSubmit } from '../../../hooks/useSpendSubmit'
import { characterDecorOf, requiredCharacterOptions } from '../character-options'
import { useSaleFeeChoice } from '../income/sale-fee'
import { AmountInput, FieldCard, FieldRow, SelectRow } from '../sheet-fields'
import { useHeaderSlot, useSaveSlot, type SpendFormProps } from './form-shared'

export function BossIncomeTransferForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const transfer = props.editing?.transfer
  const [sender, setSender] = useState<string | null>(props.editing?.ocid ?? null)
  const [receiver, setReceiver] = useState<string | null>(transfer?.receiverOcid ?? null)
  const [amountText, setAmountText] = useState(transfer === undefined ? '' : mesoTextOf(transfer.transferMeso))
  /** 금액 칸이 그 주 결정석 몫인가. 금액을 손으로 고치면 꺼진다. 수정으로 열면 저장한 금액이 서므로 꺼져 있다 */
  const [fillsWeek, setFillsWeek] = useState(false)
  const fee = useSaleFeeChoice(
    transfer === undefined ? undefined : { saleFeeAuto: transfer.feeAuto, saleFeePercent: transfer.feePercent as FeePercent },
    receiver,
    props.dateKey,
  )
  const { saving, submit, remove } = useSpendSubmit(props)
  const { loadWeekCrystalMeso, dateKey } = props

  // 체크가 켜져 있는 동안 보내는 캐릭터나 날짜를 바꾸면 그 주 결정석 몫을 다시 채운다.
  useEffect(() => {
    if (!fillsWeek || sender === null || loadWeekCrystalMeso === undefined) return
    let alive = true
    loadWeekCrystalMeso(sender, dateKey).then(
      (meso) => {
        if (alive) setAmountText(mesoTextOf(meso))
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [fillsWeek, sender, dateKey, loadWeekCrystalMeso])

  const transferMeso = mesoValueOf(amountText)
  const percent = fee.percent ?? 0
  const feeMeso = transferFeeMeso(transferMeso, percent)
  const canSave = sender !== null && receiver !== null && transferMeso > 0 && fee.ready
  // 메소를 자기에게 보낼 일은 없어서 받는 캐릭터 목록에서 보내는 캐릭터를 뺀다.
  const receivers = props.characters.filter((character) => character.ocid !== sender)

  useSaveSlot(props.setSave, {
    showSave: true,
    editing,
    canSave,
    saving,
    onSave: () =>
      void submit({
        ocid: sender,
        spentOn: props.dateKey,
        category: 'etc',
        item: spendCategoryNameOf('boss_income_transfer'),
        itemKey: null,
        formItemKeys: null,
        itemKind: null,
        levelFrom: null,
        levelTo: null,
        quantity: 1,
        mesoAmount: feeMeso,
        tariffMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        hexa: null,
        transfer: { receiverOcid: receiver!, transferMeso, feePercent: percent, feeAuto: fee.auto },
      }),
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  useHeaderSlot(props.setHeader, {
    title: spendCategoryNameOf(props.category),
    dateKey: props.dateKey,
    todayDateKey: props.todayDateKey,
    earliestDateKey: props.earliestDateKey,
    onDateChange: props.onDateChange,
    onBack: editing ? undefined : props.onBack,
  })

  return (
    <>
      <FieldCard>
        <SelectRow
          testID="spend-sheet-transfer-sender"
          label="보내는 캐릭터"
          placeholder="캐릭터 선택"
          options={requiredCharacterOptions(props.characters)}
          selected={sender}
          onSelect={(next) => {
            setSender(next)
            if (next === receiver) setReceiver(null)
          }}
          decorOf={characterDecorOf(props.characters)}
        />
        <SelectRow
          testID="spend-sheet-transfer-receiver"
          label="받는 캐릭터"
          placeholder="캐릭터 선택"
          options={requiredCharacterOptions(receivers)}
          selected={receiver}
          onSelect={setReceiver}
          decorOf={characterDecorOf(props.characters)}
        />
        <FieldRow label="옮길 메소">
          {/* 헥사 매트릭스의 `보관 중인 조각도 지출로 기록하기` 와 같은 모양이다. 칸 이름 바로 옆에 작은 두 줄로 선다. */}
          <Pressable
            role="checkbox"
            aria-label="이번주 보스 수입 옮기기"
            aria-checked={fillsWeek}
            testID="spend-sheet-transfer-week"
            disabled={sender === null}
            onPress={() => setFillsWeek((current) => !current)}
            hitSlop={8}
            className={`flex-row items-center gap-2${sender === null ? ' opacity-40' : ''}`}
          >
            <CheckBox checked={fillsWeek} />
            <Text className="text-11 text-text-muted">{'이번주 보스\n수입 옮기기'}</Text>
          </Pressable>
          <AmountInput
            testID="spend-sheet-transfer-amount"
            label="옮길 메소"
            icon="meso"
            unit="메소"
            reading
            unitKey="bossIncomeTransfer"
            value={amountText}
            onChange={(next) => {
              setAmountText(next)
              setFillsWeek(false)
            }}
          />
          <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
        </FieldRow>
        <FeeRow testID="spend-sheet-fee" label="수수료" {...fee.row} />
      </FieldCard>

      <AmountFigure value={feeMeso} unit="메소" testID="spend-sheet-amount" />
    </>
  )
}
