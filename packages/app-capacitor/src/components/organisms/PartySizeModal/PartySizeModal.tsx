import { Users, X } from 'lucide-react'
import type { BossDifficulty } from '@core/types'
import { getBossPortraitCrop, getBossPortraitUrl } from '@core/lib/boss-icons'
import {
  MEDIA_ART_FILTER,
  MEDIA_ART_MASK_HERO,
  MEDIA_ART_OPACITY,
  MEDIA_TEXT_SHADOW,
} from '@core/lib/media-card'
import { Badge } from '../../atoms/Badge/Badge'
import { DifficultySegment } from '../../molecules/DifficultySegment/DifficultySegment'
import { PartySizeStepper } from '../../molecules/PartySizeStepper/PartySizeStepper'
import { Modal } from '../Modal/Modal'

// 보스 카드를 탭하면 열리는 파티 인원·난이도 모달 (ADR-121).
//
// **표시 전용이다** — 모드(자동/수동)를 모르고, 난이도 선택이 무엇을 뜻하는지도 모른다. 수동
// 모드에서는 멤버십 교체이고 자동 모드에서는 "어느 난이도의 파티 인원을 편집할지" 전환인데,
// 그 차이는 호출부가 핸들러로 정한다(결정 3). 여기에 모드 분기를 두면 나중에 두 모드를 통합할 때
// 지워야 할 코드가 된다.
//
// 파티 인원은 (보스 + 난이도)에 붙어 있어 난이도를 바꾸면 값과 상한이 함께 갈아탄다
// (스우: 하드 6인 / 익스트림 2인). 라벨 옆 `n / max` 배지가 그 사실을 말한다.
export function PartySizeModal(props: {
  bossName: string
  /** 히어로의 키커 — '주간 보스' / '월간 보스'. */
  cycleLabel: string
  portraitSlug: string | null
  difficulties: BossDifficulty[]
  difficulty: BossDifficulty
  partySize: number
  maxPartySize: number
  onSelectDifficulty: (difficulty: BossDifficulty) => void
  onChangePartySize: (next: number) => void
  onClose: () => void
}): React.JSX.Element {
  const portraitUrl = getBossPortraitUrl(props.portraitSlug)
  const crop = getBossPortraitCrop(props.portraitSlug)

  return (
    // align="center": 이 모달은 키보드를 띄우지 않는다(Modal 기본은 'top').
    // Modal.Panel: 일러스트가 모서리까지 가야 해서 카드 껍데기(p-6)를 쓰지 않고 직접 두른다.
    <Modal onClose={props.onClose} align="center" testId="party-size-modal">
      <Modal.Panel maxWidth="max-w-2xs">
        {/* 바깥 테두리의 라이트 테마 톤다운은 Modal.Panel 이 걸어준다([[ADR-122]]) — 이 div 가 그
            직계 자식이다. 안쪽 border-t 는 표면 위 구분선이라 대상이 아니다. */}
        <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
          {/* 히어로 — 카드와 같은 bleed 레시피(ADR-018). media-scope 안이라 bg-surface·text-text 가
              media-* 로 해석된다(ADR-064 결정 5). 일러스트가 없는 보스는 단색 띠에 이름만 남는다. */}
          <div className="media-scope relative h-22 bg-surface">
            {portraitUrl !== null && (
              <div
                data-testid="party-size-modal-art"
                className="absolute inset-0 bg-no-repeat"
                style={{
                  backgroundImage: `url(${portraitUrl})`,
                  backgroundSize: crop.size,
                  backgroundPosition: crop.position,
                  filter: MEDIA_ART_FILTER,
                  opacity: MEDIA_ART_OPACITY,
                  maskImage: MEDIA_ART_MASK_HERO,
                  WebkitMaskImage: MEDIA_ART_MASK_HERO,
                }}
              />
            )}

            {/* 글자를 앉히는 베일 — 하드코딩 rgba 가 아니라 스코프의 surface 를 쓴다. */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(0deg, var(--color-surface) 0%, transparent 62%)' }}
            />

            <button
              type="button"
              onClick={props.onClose}
              aria-label="닫기"
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface/60 text-text"
            >
              <X className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden="true" />
            </button>

            <div className="absolute inset-x-[18px] bottom-3" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
              <p className="text-[10px] font-bold tracking-[.16em] text-text-muted">{props.cycleLabel}</p>
              <p className="text-xl font-extrabold tracking-[-.02em] text-text">{props.bossName}</p>
            </div>
          </div>

          {/* 경계선은 media-scope **바깥**이다 — 다크 테마는 media-surface ≈ surface 이고
              검은마법사는 값이 완전히 같아(#1C1319) 이 선이 유일한 경계다. */}
          <div className="flex flex-col gap-[18px] border-t border-border p-[18px]">
            <section>
              <p className="mb-2.5 text-xs font-bold tracking-[.06em] text-text-muted">난이도</p>
              <DifficultySegment
                difficulties={props.difficulties}
                selected={props.difficulty}
                onSelect={props.onSelectDifficulty}
              />
            </section>

            <section>
              <div className="mb-2.5 flex items-center justify-between gap-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold tracking-[.06em] text-text-muted">
                  <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  파티 인원
                </span>
                {/* 주간 n/12 배지와 같은 컴포넌트다 — 신규 스타일을 만들지 않는다. */}
                <Badge tone="primary" className="tabular-nums">
                  {props.partySize} / {props.maxPartySize}
                </Badge>
              </div>
              <PartySizeStepper
                label={props.bossName}
                value={props.partySize}
                max={props.maxPartySize}
                onChange={props.onChangePartySize}
              />
            </section>
          </div>
        </div>
      </Modal.Panel>
    </Modal>
  )
}
