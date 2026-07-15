import type { CharacterPickerEntry, DailyContent, WeeklyContent } from '../../types'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { matchDailyQuestRegionSlug, stripDailyQuestPrefix } from '../../lib/daily-quest-matching'
import { useEffect, useState } from 'react'

import type { BossPortraitCrop } from '../../lib/boss-icons'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import type { DailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { RefreshCw } from 'lucide-react'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import { getDailyQuestRegionIconUrl } from '../../lib/daily-quest-icons'
import { matchWeeklyRegionalQuestSlug } from '../../lib/weekly-regional-quest-matching'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'

type ContentTab = 'daily' | 'weekly'

// "몬스터파크"만 배경+아이콘 카드로 확장한다 — 다른 kind: 'contents' 항목이 생기면 그때
// 매핑 테이블로 일반화할지 재검토한다(현재는 인스턴스가 하나뿐이라 과설계 방지, ADR-020).
const MONSTER_PARK_NAME = '몬스터파크'
const MONSTER_PARK_BACKGROUND_SLUG = 'monsterPark'

// 주간 탭 카테고리 분류 상수 (ADR-021)
const EPIC_DUNGEON_PREFIX = '에픽 던전 : '
const EPIC_DUNGEON_BACKGROUND_SLUGS: Record<string, string> = {
  하이마운틴: 'ancientGodMitra',
  '앵글러 컴퍼니': 'senya',
  악몽선경: 'baekyeon',
}

const MU_LUNG_DOJO_NAME = '무릉도장'

const GUILD_PREFIX = '[길드] '
const GUILD_MISSION_POINTS_NAME = '[길드] 주간 미션 포인트'
const GUILD_UNDERGROUND_WATERWAY_NAME = '[길드] 지하 수로'
const GUILD_FLAG_RACE_NAME = '[길드] 플래그 레이스'
const GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG = 'arcanus'
const GUILD_MISSION_POINTS_BACKGROUND_SLUG = 'hallOfHeroes'
const GUILD_FLAG_RACE_BACKGROUND_SLUG = 'flagRace'

const QUEST_STATE_LABELS: Record<0 | 1 | 2, string> = {
  0: '시작 안함',
  1: '진행 중',
  2: '완료',
}

const QUEST_STATE_BADGE_CLASSES: Record<0 | 1 | 2, string> = {
  0: 'bg-white/10 text-[#E8DFEC]/70',
  1: 'bg-white/20 text-[#E8DFEC]',
  2: 'bg-secondary text-bg',
}

export function QuestStateBadge(props: { questState: 0 | 1 | 2 }): React.JSX.Element {
  const fontWeight = props.questState === 2 ? 'font-bold' : 'font-semibold'
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs ${fontWeight} ${QUEST_STATE_BADGE_CLASSES[props.questState]}`}
    >
      {QUEST_STATE_LABELS[props.questState]}
    </span>
  )
}

export function DailyQuestCard(props: {
  content: DailyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripDailyQuestPrefix(content.name)
  const backgroundSlug = matchDailyQuestRegionSlug(displayName)
  const backgroundUrl = getDailyQuestBackgroundUrl(backgroundSlug)
  const iconUrl = getDailyQuestRegionIconUrl(backgroundSlug)
  const crop = props.crop ?? getDailyQuestRegionCrop(backgroundSlug)
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'

  // 카드 배경/보더/이름 텍스트는 BossCard와 동일하게 앱 테마와 무관하게 레테(다크) 고정 배색을
  // 쓴다 — 일러스트 bleed·페이드·text-shadow가 어두운 배경을 전제로 튜닝됐기 때문(ADR-018/020).
  return (
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage,
            WebkitMaskImage: maskImage,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          {iconUrl !== null && (
            <img src={iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" aria-hidden="true" />
          )}
          <span
            className="text-sm font-medium text-[#E8DFEC]"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)' }}
          >
            {displayName}
          </span>
        </div>

        {content.questState !== null && <QuestStateBadge questState={content.questState} />}
      </div>
    </div>
  )
}

export function MonsterParkCard(props: {
  content: DailyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const backgroundUrl = getDailyQuestBackgroundUrl(MONSTER_PARK_BACKGROUND_SLUG)
  const iconUrl = getDailyQuestRegionIconUrl(MONSTER_PARK_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(MONSTER_PARK_BACKGROUND_SLUG)
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'
  const progressPercent = content.maxCount > 0 ? Math.min((content.nowCount / content.maxCount) * 100, 100) : 0

  return (
    <div className="relative h-28 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage,
            WebkitMaskImage: maskImage,
          }}
        />
      )}

      <div className="relative flex h-full flex-col">
        <div className="flex h-20 shrink-0 items-center justify-between" style={{ padding: '0 14px' }}>
          <div className="flex items-center gap-2">
            {iconUrl !== null && (
              <img src={iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" aria-hidden="true" />
            )}
            <span
              className="text-sm font-medium text-[#E8DFEC]"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)' }}
            >
              {content.name}
            </span>
          </div>

          <span className="rounded-full bg-third/20 px-2.5 py-1 text-xs font-semibold text-third">
            {content.nowCount}/{content.maxCount}
          </span>
        </div>

        {content.maxCount > 0 && (
          <div className="flex flex-1 items-start px-[14px] pt-0">
            <div
              role="progressbar"
              aria-valuenow={content.nowCount}
              aria-valuemin={0}
              aria-valuemax={content.maxCount}
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-1.5 rounded-full bg-third" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 아르카누스 배경의 푸른 전기빛과 맞춘 색(2026-07-14, 사용자 지시) — 에픽 던전·길드 카드가 공유.
function CategoryBadge(props: { label: string }): React.JSX.Element {
  return (
    <span className="rounded-full bg-[#4DD2FF]/20 px-2.5 py-1 text-xs font-semibold text-[#4DD2FF]">
      {props.label}
    </span>
  )
}

const CARD_MASK_IMAGE = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'
const CARD_NAME_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)'

export function EpicDungeonCard(props: {
  content: WeeklyContent
  crop?: BossPortraitCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = content.name.startsWith(EPIC_DUNGEON_PREFIX)
    ? content.name.slice(EPIC_DUNGEON_PREFIX.length)
    : content.name
  const backgroundSlug = EPIC_DUNGEON_BACKGROUND_SLUGS[displayName] ?? null
  const backgroundUrl = getBossPortraitUrl(backgroundSlug)
  const crop = props.crop ?? getBossPortraitCrop(backgroundSlug)
  const questState: 0 | 2 = content.nowCount > 0 ? 2 : 0

  return (
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <CategoryBadge label="에픽 던전" />
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <QuestStateBadge questState={questState} />
      </div>
    </div>
  )
}

export function WeeklyRegionalContentCard(props: {
  content: WeeklyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const backgroundSlug = matchWeeklyRegionalQuestSlug(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(backgroundSlug)
  const iconUrl = getDailyQuestRegionIconUrl(backgroundSlug)
  const crop = props.crop ?? getDailyQuestRegionCrop(backgroundSlug)
  const questState: 0 | 2 = content.nowCount > 0 ? 2 : 0

  return (
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          {iconUrl !== null && (
            <img src={iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
            {content.name}
          </span>
        </div>

        <QuestStateBadge questState={questState} />
      </div>
    </div>
  )
}

export function MuLungDojoCard(props: { content: WeeklyContent }): React.JSX.Element {
  return (
    <div
      className="relative flex h-20 items-center overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]"
      style={{ padding: '0 14px' }}
    >
      <span className="text-sm font-medium text-[#E8DFEC]">{props.content.name}</span>
    </div>
  )
}

function stripGuildPrefix(name: string): string {
  return name.startsWith(GUILD_PREFIX) ? name.slice(GUILD_PREFIX.length) : name
}

export function GuildUndergroundWaterwayCard(props: {
  content: WeeklyContent
  crop?: BossPortraitCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getBossPortraitUrl(GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG)
  const crop = props.crop ?? getBossPortraitCrop(GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG)

  return (
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <CategoryBadge label="길드" />
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <span className="rounded-full bg-third/20 px-2.5 py-1 text-xs font-semibold text-third">
          {content.nowCount}점
        </span>
      </div>
    </div>
  )
}

export function GuildMissionPointsCard(props: {
  content: WeeklyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(GUILD_MISSION_POINTS_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(GUILD_MISSION_POINTS_BACKGROUND_SLUG)
  const progressPercent = content.maxCount > 0 ? Math.min((content.nowCount / content.maxCount) * 100, 100) : 0

  return (
    <div className="relative h-28 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full flex-col">
        <div className="flex h-20 shrink-0 items-center justify-between" style={{ padding: '0 14px' }}>
          <div className="flex items-center gap-2">
            <CategoryBadge label="길드" />
            <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
              {displayName}
            </span>
          </div>

          <span className="rounded-full bg-third/20 px-2.5 py-1 text-xs font-semibold text-third">
            {content.nowCount}/{content.maxCount}
          </span>
        </div>

        {content.maxCount > 0 && (
          <div className="flex flex-1 items-start px-[14px] pt-0">
            <div
              role="progressbar"
              aria-valuenow={content.nowCount}
              aria-valuemin={0}
              aria-valuemax={content.maxCount}
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-1.5 rounded-full bg-third" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function GuildFlagRaceCard(props: {
  content: WeeklyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(GUILD_FLAG_RACE_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(GUILD_FLAG_RACE_BACKGROUND_SLUG)
  const questState: 0 | 2 = content.nowCount > 0 ? 2 : 0

  return (
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <CategoryBadge label="길드" />
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <QuestStateBadge questState={questState} />
      </div>
    </div>
  )
}

export function ContentScreen(): React.JSX.Element {
  const {
    status,
    characters,
    error,
    trackedOcids,
    selectedOcid,
    loadTrackedOcids,
    saveTrackedOcids,
    refresh,
    selectCharacter,
  } = useContentSchedulerStore()
  const [activeTab, setActiveTab] = useState<ContentTab>('daily')
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-015: 후보 목록에 이미지·access_flag가 필요해져 피커를 열 때만 조회한다
  // (마운트 시 매번 호출하면 화면에 들어오기만 해도 캐릭터 수만큼 병렬 호출이 발생함).
  // ADR-016: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(전체를 기다리지 않음).
  // ADR-017 결정 6: character/list 응답을 기다리는 동안에도 character-basic-cache에 이미
  // 있는 캐릭터(추적 여부 무관)는 즉시 먼저 보여줘, 피커를 열 때마다 짧게 비어 보이던 문제를
  // 완화한다.
  useEffect(() => {
    if (!isPickerOpen) return
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isPickerOpen])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  const registeredDailyContents =
    selected !== null ? selected.dailyContents.filter((content) => content.isRegistered) : []

  const weeklyContents = selected !== null ? selected.weeklyContents : []

  const registeredWeeklyContents = weeklyContents.filter((content) => content.isRegistered)

  async function handleSaveTracking(ocids: string[]): Promise<void> {
    await saveTrackedOcids(ocids)
    setIsPickerOpen(false)
  }

  const characterManageButton = (
    <button
      type="button"
      onClick={() => setIsPickerOpen(true)}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      캐릭터 관리
    </button>
  )

  const trackingPicker = isPickerOpen && (
    <CharacterTrackingPicker
      entries={roster}
      trackedOcids={trackedOcids ?? []}
      onSave={handleSaveTracking}
      onClose={() => setIsPickerOpen(false)}
    />
  )

  if (isEmpty) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">컨텐츠 스케줄러</h1>
          {characterManageButton}
        </div>

        <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
          표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요
        </div>

        {trackingPicker}
      </div>
    )
  }

  return (
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 제목~탭까지는 화면 상단에 고정하고 그 아래 컨텐츠 목록만 스크롤되게 한다 — sticky는
          페이지 스크롤 위에서 동작하므로 App.tsx의 레이아웃(높이 계산)을 건드릴 필요가 없다.
          sticky 박스는 top-0으로 화면 맨 위(노치 포함)부터 bg-bg로 덮어야 스크롤 중에도 그
          위 카드가 비치지 않는다 — top을 안전영역만큼 내리면 그 위 구간은 아무것도 덮지
          못해 스크롤되는 카드가 노치 뒤로 비쳐 보인다. 대신 padding-top에 안전영역을 더해
          텍스트만 내려 보이게 하고, 바깥 AppShell의 padding-top과 중복되지 않도록 위
          -mt-[var(--sa-top)]로 상쇄한다. z-10으로 항상 위에 그려지게 한다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text">컨텐츠 스케줄러</h1>
            {characterManageButton}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {characters.length > 0 && selected !== null && (
                <CharacterSelectDropdown
                  characters={characters}
                  selectedOcid={selected.ocid}
                  onSelect={(ocid) => {
                    void selectCharacter(ocid)
                  }}
                />
              )}

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <p className="text-sm text-text-muted whitespace-nowrap">
                  {selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
                </p>
                <button
                  type="button"
                  onClick={() => refresh(trackedOcids ?? [])}
                  aria-label="새로고침"
                  className="p-2 text-primary-text hover:text-primary-hover"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>

            {selected !== null && selected.isStale && (
              <p className="text-sm text-error">
                {selected.error !== null ? formatScheduleSyncError(selected.error) : ''}
              </p>
            )}
          </div>

          {status === 'error' && (
            <p className="text-sm text-error">
              {error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}
            </p>
          )}

          {/* ADR-016: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
              "불러오는 중"은 보여줄 데이터가 아예 없을 때만 표시한다. */}
          {(status === 'idle' || status === 'loading') && characters.length === 0 && (
            <p className="text-sm text-text-muted">불러오는 중...</p>
          )}

          {characters.length > 0 && selected !== null && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className={
                  activeTab === 'daily'
                    ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
                    : 'px-3 text-sm font-medium text-text-muted'
                }
              >
                일간
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weekly')}
                className={
                  activeTab === 'weekly'
                    ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
                    : 'px-3 text-sm font-medium text-text-muted'
                }
              >
                주간
              </button>
            </div>
          )}
        </div>

        {/* 헤더 아래에 살짝 겹쳐 그라데이션+블러로 항목이 잘려 보이지 않고 자연스럽게
            사라지도록 한다 — 배경(bg-bg → transparent)과 블러 강도를 같은 마스크로 함께
            줄여서, 색만 옅어지고 블러는 그대로인 부자연스러운 경계가 생기지 않게 한다. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {characters.length > 0 && selected !== null && (
        <div className="space-y-4 px-4 pb-4">
          {activeTab === 'daily' && (
            <>
              {registeredDailyContents.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredDailyContents.length > 0 && (
                <ul className="space-y-3">
                  {registeredDailyContents.map((content) => {
                    if (content.kind === 'quest') {
                      return (
                        <li key={content.name}>
                          <DailyQuestCard content={content} />
                        </li>
                      )
                    }

                    if (content.name === MONSTER_PARK_NAME) {
                      return (
                        <li key={content.name}>
                          <MonsterParkCard content={content} />
                        </li>
                      )
                    }

                    return (
                      <li
                        key={content.name}
                        className="rounded-[14px] bg-surface border border-border p-4 space-y-2"
                      >
                        <p className="text-sm text-text">
                          {content.name} · {content.nowCount}/{content.maxCount}
                        </p>
                        {content.maxCount > 0 && (
                          <div
                            role="progressbar"
                            aria-valuenow={content.nowCount}
                            aria-valuemin={0}
                            aria-valuemax={content.maxCount}
                            className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden"
                          >
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${Math.min((content.nowCount / content.maxCount) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}

          {activeTab === 'weekly' && (
            <>
              {registeredWeeklyContents.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredWeeklyContents.length > 0 && (
                <ul className="space-y-3">
                  {registeredWeeklyContents.map((content) => {
                    if (content.name === GUILD_UNDERGROUND_WATERWAY_NAME) {
                      return (
                        <li key={content.name}>
                          <GuildUndergroundWaterwayCard content={content} />
                        </li>
                      )
                    }

                    if (content.name === GUILD_MISSION_POINTS_NAME) {
                      return (
                        <li key={content.name}>
                          <GuildMissionPointsCard content={content} />
                        </li>
                      )
                    }

                    if (content.name === GUILD_FLAG_RACE_NAME) {
                      return (
                        <li key={content.name}>
                          <GuildFlagRaceCard content={content} />
                        </li>
                      )
                    }

                    if (content.name.startsWith(EPIC_DUNGEON_PREFIX)) {
                      return (
                        <li key={content.name}>
                          <EpicDungeonCard content={content} />
                        </li>
                      )
                    }

                    if (matchWeeklyRegionalQuestSlug(content.name) !== null) {
                      return (
                        <li key={content.name}>
                          <WeeklyRegionalContentCard content={content} />
                        </li>
                      )
                    }

                    if (content.name === MU_LUNG_DOJO_NAME) {
                      return (
                        <li key={content.name}>
                          <MuLungDojoCard content={content} />
                        </li>
                      )
                    }

                    return (
                      <li
                        key={content.name}
                        className="rounded-[14px] bg-surface border border-border p-4 space-y-2"
                      >
                        <p className="text-sm text-text">
                          {content.name} · {content.nowCount}/{content.maxCount}
                        </p>
                        {content.maxCount > 0 && (
                          <div
                            role="progressbar"
                            aria-valuenow={content.nowCount}
                            aria-valuemin={0}
                            aria-valuemax={content.maxCount}
                            className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden"
                          >
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${Math.min((content.nowCount / content.maxCount) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {trackingPicker}
    </div>
  )
}
