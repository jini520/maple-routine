/**
 * 사냥 기록을 고치거나 지워 조각이 모자라게 될 때, 함께 줄일 뒤 기록을 확인 창에 보이고 함께 저장하는 자리.
 *
 * 계획은 저장소가 센다. 여기서는 그 계획을 확인 창의 줄로 옮기고, 창에서 받은 가격과 함께 저장소에 돌려준다.
 */
import { create } from 'zustand'

import { formatMonthDay } from '../../lib/calendar'
import {
  cutNeedsPrice,
  FragmentCutsChangedError,
  type FragmentCutChange,
  type FragmentCutPlan,
} from '../../storage/fragment-cuts'
import {
  deleteIncomeRecord,
  previewIncomeCuts,
  updateIncomeRecord,
  type IncomeChange,
  type IncomeRecord,
} from '../../storage/income'
import { loadHexaCandidatesOf, loadHexaOwnerOf, namesByOcid, recordCardOf } from './records'

/** 사냥 기록 하나를 고치거나 지우는 일. */
export type HuntChange = IncomeChange

/** 확인 창의 한 줄. 함께 바뀌는 기록 하나다. */
export interface FragmentCutRow {
  id: string
  /** 하루 목록과 같은 이름. */
  name: string
  /** `9월 18일 · 캐릭터` */
  sub: string
  /** 정산은 판 개수, 헥사는 보관에서 가져온 개수. */
  fragmentsBefore: number
  fragmentsAfter: number
  /** 정산은 수입, 헥사는 지출. 금액 글자의 색이 갈린다. */
  side: 'income' | 'spend'
  mesoBefore: number
  /** 가격을 받아야 셀 수 있으면 `null` 이다. */
  mesoAfter: number | null
  /** 0개가 되어 지우는 정산. */
  removed: boolean
  /** 가격을 받으면 곱할 개수. 가격이 필요 없는 줄은 0 이다. */
  pricedFragments: number
}

/** 확인 창에 보일 계획. `rows` 가 비면 창 없이 저장한다. */
export interface FragmentCutPreview {
  change: HuntChange
  rows: FragmentCutRow[]
  key: string
  candidatesOf: (ocid: string) => readonly string[]
  /** 헥사 강화가 기타 조각을 가져올 메이플 ID · 월드 */
  ownerOf?: (ocid: string) => { accountId: string; worldKey: string } | null
}

function takenOf(record: {
  hexa: { storageUses: readonly { fragments: number }[]; otherUse?: { fragments: number } } | null
}): number {
  return (record.hexa?.storageUses ?? []).reduce((sum, use) => sum + use.fragments, record.hexa?.otherUse?.fragments ?? 0)
}

/** 보관에서 가져온 개수가 그대로인 헥사 기록. 다른 캐릭터의 보관으로 옮겼을 뿐이라 화면에 보이는 것이 안 바뀐다. */
function isSilent(change: FragmentCutChange): boolean {
  return change.kind === 'hexa' && takenOf(change.before) === takenOf(change.after)
}

function rowOf(change: FragmentCutChange, names: ReadonlyMap<string, string>): FragmentCutRow {
  const ocid = change.before.ocid ?? ''
  const subOf = (date: string): string => [formatMonthDay(date), names.get(ocid)].filter(Boolean).join(' · ')
  if (change.kind === 'settle') {
    const card = recordCardOf({ kind: 'income', record: change.before, characterName: '' })
    return {
      id: change.before.id,
      name: card.detail ?? card.title,
      sub: subOf(change.before.earnedOn),
      fragmentsBefore: change.before.quantity ?? 0,
      fragmentsAfter: change.after?.quantity ?? 0,
      side: 'income',
      mesoBefore: change.before.mesoAmount ?? 0,
      mesoAfter: change.after?.mesoAmount ?? 0,
      removed: change.after === null,
      pricedFragments: 0,
    }
  }
  const card = recordCardOf({ kind: 'spend', record: change.before, characterName: '' })
  const needsPrice = cutNeedsPrice(change)
  const hexa = change.after.hexa!
  return {
    id: change.before.id,
    name: card.detail ?? card.title,
    sub: subOf(change.before.spentOn),
    fragmentsBefore: takenOf(change.before),
    fragmentsAfter: takenOf(change.after),
    side: 'spend',
    mesoBefore: change.before.mesoAmount ?? 0,
    mesoAfter: needsPrice ? null : (change.after.mesoAmount ?? 0),
    removed: false,
    pricedFragments: needsPrice ? hexa.fragmentCount - hexa.untradableFragmentCount - takenOf(change.after) : 0,
  }
}

async function rowsOf(plan: FragmentCutPlan): Promise<FragmentCutRow[]> {
  const shown = plan.changes.filter((change) => !isSilent(change))
  const names = await namesByOcid([...new Set(shown.map((change) => change.before.ocid ?? ''))])
  return shown.map((change) => rowOf(change, names))
}

/** 사냥 기록을 고치거나 지우면 함께 바뀔 뒤 기록. */
async function previewHuntCuts(change: HuntChange): Promise<FragmentCutPreview> {
  const [candidatesOf, ownerOf] = await Promise.all([loadHexaCandidatesOf(), loadHexaOwnerOf()])
  const plan = await previewIncomeCuts(change, candidatesOf, ownerOf)
  return { change, rows: await rowsOf(plan), key: plan.key, candidatesOf, ownerOf }
}

/**
 * 사냥 기록의 수정 · 삭제와 함께 바뀌는 기록을 한 번에 저장한다. 계획이 달라졌으면 `FragmentCutsChangedError` 를 던진다.
 *
 * @param prices 가격이 필요한 헥사 기록에 넣을 개당 가격. 기록 id 가 열쇠이고 0 도 값이다
 */
async function saveHuntChange(preview: FragmentCutPreview, prices: Readonly<Record<string, number>>): Promise<void> {
  const approval = { candidatesOf: preview.candidatesOf, ownerOf: preview.ownerOf, key: preview.key, prices }
  const { change } = preview
  if (change.kind === 'edit') await updateIncomeRecord(change.record, approval)
  else await deleteIncomeRecord(change.id, approval)
}

/** 띄운 확인 창. `answer` 에 `함께 저장` 이면 받은 가격, `취소` 면 `null` 을 넘긴다. */
export interface FragmentCutsPrompt {
  preview: FragmentCutPreview
  /** 고치거나 지우는 사냥 기록의 저장된 모습. 설명 문장에 날짜와 조각 수가 선다. */
  hunt: IncomeRecord
  answer: (prices: Readonly<Record<string, number>> | null) => void
}

/** 지금 띄운 확인 창. 앱 뿌리의 `FragmentCutsHost` 가 그린다. */
export const useFragmentCutsPrompt = create<{ prompt: FragmentCutsPrompt | null }>()(() => ({ prompt: null }))

function askFragmentCuts(preview: FragmentCutPreview, hunt: IncomeRecord): Promise<Readonly<Record<string, number>> | null> {
  return new Promise((resolve) => {
    useFragmentCutsPrompt.setState({
      prompt: {
        preview,
        hunt,
        answer: (prices) => {
          useFragmentCutsPrompt.setState({ prompt: null })
          resolve(prices)
        },
      },
    })
  })
}

/**
 * 사냥 기록을 고치거나 지운다. 뒤 기록이 함께 바뀌면 확인 창을 띄워 답을 받고 한 번에 저장한다. 창을 띄운 뒤 다른 저장으로
 * 계획이 달라졌으면 다시 세서 창을 다시 띄운다. 사용자가 본 것과 다른 기록이 바뀌면 안 되기 때문이다.
 *
 * @param hunt 고치거나 지우는 사냥 기록의 저장된 모습
 * @returns 저장했으면 `true`, 확인 창에서 취소했으면 `false`
 */
export async function saveHuntWithCuts(hunt: IncomeRecord, change: HuntChange): Promise<boolean> {
  for (;;) {
    const preview = await previewHuntCuts(change)
    const prices = preview.rows.length === 0 ? {} : await askFragmentCuts(preview, hunt)
    if (prices === null) return false
    try {
      await saveHuntChange(preview, prices)
      return true
    } catch (error) {
      if (!(error instanceof FragmentCutsChangedError)) throw error
    }
  }
}
