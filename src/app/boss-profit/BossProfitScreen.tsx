import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import weeklyBossesData from '../../data/weekly-bosses.json'
import { useBossProfitStore, type BossProfitRow, type BossProfitStore } from '../../features/boss-profit/store'
import { formatScheduleSyncError } from '../../features/schedule-sync/format'

const PERIOD_ORDER = ['이번 주', '이번 달'] as const

interface BossReferenceEntry {
  boss: string
  portraitSlug?: string
}

const REFERENCE_ENTRIES: BossReferenceEntry[] = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]),
]

function findPortraitSlug(boss: string): string | null {
  return REFERENCE_ENTRIES.find((entry) => entry.boss === boss)?.portraitSlug ?? null
}

function rowKey(row: BossProfitRow): string {
  return `${row.ocid}-${row.boss}-${row.difficulty}-${row.cycle}-${row.periodKey}`
}

interface BossProfitRowItemProps {
  row: BossProfitRow
  setPartySize: BossProfitStore['setPartySize']
}

function BossProfitRowItem(props: BossProfitRowItemProps): React.JSX.Element {
  const { row } = props
  const [inputValue, setInputValue] = useState(row.partySize !== null ? String(row.partySize) : '')
  const [inputError, setInputError] = useState<string | null>(null)

  async function handleBlur(): Promise<void> {
    const trimmed = inputValue.trim()
    if (trimmed === '') {
      return
    }

    try {
      await props.setPartySize(row, Number(trimmed))
      setInputError(null)
    } catch (err) {
      setInputError(err instanceof Error ? err.message : '파티원 수를 확인해주세요')
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-[14px] bg-white border border-[#F0DFD1] p-4">
      <div className="h-10 w-10 shrink-0">
        <BossPortrait portraitSlug={findPortraitSlug(row.boss)} difficulty={row.difficulty} label={row.boss} />
      </div>

      <div className="flex-1 space-y-1">
        <p className="text-sm text-[#5B4636]">
          {row.characterName} · {row.boss} · {row.difficulty}
        </p>

        {row.priceMeso === null && (
          <span className="inline-block rounded-full bg-[#FFE9DB] px-2 py-0.5 text-xs font-medium text-[#C2410C]">
            가격 미확정
          </span>
        )}

        {row.priceMeso !== null && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={row.maxPartySize}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onBlur={handleBlur}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수`}
              className="w-16 rounded-[10px] border border-[#F0DFD1] px-2 py-1 text-sm text-[#2B1B10]"
            />

            {row.partySize === null && <span className="text-sm text-[#8A7362]">파티원 수를 입력해주세요</span>}

            {row.payoutMeso !== null && (
              <span className="text-sm font-semibold text-[#2B1B10]">{row.payoutMeso.toLocaleString()} 메소</span>
            )}
          </div>
        )}

        {inputError !== null && <p className="text-sm text-[#B91C1C]">{inputError}</p>}
      </div>
    </li>
  )
}

function BossProfitSection(props: {
  label: string
  rows: BossProfitRow[]
  setPartySize: BossProfitStore['setPartySize']
}): React.JSX.Element {
  const total = props.rows.reduce((sum, row) => sum + (row.payoutMeso ?? 0), 0)

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-[#2B1B10]">
        {props.label} 합계 {total.toLocaleString()} 메소
      </h2>

      <ul className="space-y-2">
        {props.rows.map((row) => (
          <BossProfitRowItem key={rowKey(row)} row={row} setPartySize={props.setPartySize} />
        ))}
      </ul>
    </section>
  )
}

export function BossProfitScreen(): React.JSX.Element {
  const { status, rows, error, staleCharacterNames, trackedOcids, loadTrackedOcids, refresh, setPartySize } =
    useBossProfitStore()

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  if (isEmpty) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-semibold text-[#2B1B10]">주간 보스 수익 계산기</h1>

        <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
          추적 중인 캐릭터가 없습니다 — 보스 스케줄러에서 캐릭터를 선택해주세요
        </div>
      </div>
    )
  }

  const sections = PERIOD_ORDER.map((label) => ({
    label,
    rows: rows.filter((row) => row.periodLabel === label),
  })).filter((section) => section.rows.length > 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#2B1B10]">주간 보스 수익 계산기</h1>
        <button
          type="button"
          onClick={() => refresh(trackedOcids ?? [])}
          aria-label="새로고침"
          className="p-2 text-[#C2410C] hover:text-[#E6652E]"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {staleCharacterNames.length > 0 && (
        <p className="text-sm text-[#B91C1C]">
          일부 캐릭터 동기화 실패: {staleCharacterNames.join(', ')} — 마지막 동기화 결과를 표시 중입니다
        </p>
      )}

      {(status === 'idle' || status === 'loading') && <p className="text-sm text-[#8A7362]">불러오는 중...</p>}

      {status === 'error' && (
        <p className="text-sm text-[#B91C1C]">{error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}</p>
      )}

      {status === 'loaded' && rows.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
          아직 처치한 보스가 없습니다
        </div>
      )}

      {status === 'loaded' &&
        sections.map((section) => (
          <BossProfitSection key={section.label} label={section.label} rows={section.rows} setPartySize={setPartySize} />
        ))}
    </div>
  )
}
