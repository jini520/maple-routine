import { useState } from 'react'

import { autoFeeFrom, useAutoFee, useMvpGradeContext, type AutoFee } from '../../../features/mvp-grade/store'
import type { FeePercent } from '../../../lib/cashbook/item-split'
import type { IncomeRecord } from '../../../storage/income'

/**
 * `자동` 을 끄면 서는 수수료 조각 셋.
 *
 * 3%·5% 만 두면 직거래를 못 적고, 무엇보다 수수료 칸이 생기기 전에 적힌 행이 거짓이 된다.
 * 수정 시트가 그 행을 열 때 요율 하나를 억지로 세우면 열기만 해도 금액이 달라진다.
 */
export const FEE_OPTIONS = ['없음', '3%', '5%'] as const

type FeeOption = (typeof FEE_OPTIONS)[number]

function feeOptionOf(percent: FeePercent | null): FeeOption {
  return percent === null ? '없음' : (`${percent}%` as FeeOption)
}

function feePercentOf(option: FeeOption): FeePercent | null {
  return option === '없음' ? null : (Number(option.replace('%', '')) as FeePercent)
}

export interface SaleFeeChoice {
  /** 지금 뗄 요율. `null` 은 없음이거나 자동인데 요율을 아직 모르는 것 */
  percent: FeePercent | null
  auto: boolean
  /** 자동인데 요율을 아직 모르면(캐릭터를 고르기 전) 거짓. 저장을 막는다 */
  ready: boolean
  /** 그 캐릭터에서 뗄 요율. 모든 캐릭터로 정산할 때 자동 요율이 캐릭터마다 다르다 */
  percentOf: (ocid: string) => FeePercent | null
  /** `FeeRow` 에 그대로 넘기는 값 */
  row: {
    auto: boolean
    onAutoChange: (auto: boolean) => void
    autoFee: AutoFee | null
    autoPlaceholder: string | undefined
    options: typeof FEE_OPTIONS
    selected: FeeOption
    onSelect: (option: FeeOption) => void
  }
}

/**
 * 판매 수수료를 고르는 수입 폼의 상태. 새 기록은 자동으로 시작하고, 수정으로 연 옛 행은 저장된 자동 여부를 따른다.
 *
 * @param everyone 모든 캐릭터로 정산할 때의 캐릭터들. 주면 `ocid` 대신 이 캐릭터들의 자동 요율을 본다
 * @example const fee = useSaleFeeChoice(props.editing, ocid, props.dateKey)
 */
export function useSaleFeeChoice(
  editing: IncomeRecord | undefined,
  ocid: string | null,
  dateKey: string,
  everyone?: readonly string[],
): SaleFeeChoice {
  const [auto, setAuto] = useState(editing === undefined ? true : editing.saleFeeAuto)
  const [manual, setManual] = useState<FeePercent | null>(editing?.saleFeePercent ?? null)
  const single = useAutoFee(ocid, dateKey)
  const context = useMvpGradeContext()
  const autoFeeOf = (each: string): AutoFee | null => (context === null ? null : autoFeeFrom(context, each, dateKey))
  const fees = everyone?.map(autoFeeOf) ?? []
  /** 자동 요율이 캐릭터마다 다른가. 그때 줄에 등급 하나를 세우면 거짓이 된다 */
  const mixed = fees.some((each) => each?.grade !== fees[0]?.grade)
  const autoFee = everyone === undefined ? single : mixed ? null : (fees[0] ?? null)
  return {
    percent: auto ? (autoFee?.percent ?? null) : manual,
    auto,
    ready: !auto || (everyone === undefined ? autoFee !== null : context !== null),
    percentOf: (each) => (auto ? (autoFeeOf(each)?.percent ?? null) : manual),
    row: {
      auto,
      onAutoChange: (next) => {
        // 끄는 순간 방금까지 자동이던 요율을 고른 채 선다. 끄는 것만으로는 금액이 안 움직인다.
        if (!next && autoFee !== null) setManual(autoFee.percent)
        setAuto(next)
      },
      autoFee,
      // 요율은 캐릭터가 속한 ID 의 등급에서 온다. 새 기록은 캐릭터가 빈 채로 열린다.
      autoPlaceholder:
        everyone !== undefined ? (mixed ? '메이플 ID 별 수수료 적용' : undefined) : ocid === null ? '캐릭터를 선택해 주세요' : undefined,
      options: FEE_OPTIONS,
      selected: feeOptionOf(manual),
      onSelect: (option) => setManual(feePercentOf(option)),
    },
  }
}
