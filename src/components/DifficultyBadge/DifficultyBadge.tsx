import type { BossDifficulty } from '../../types'

const DIFFICULTY_BADGE_STYLES: Record<BossDifficulty, React.CSSProperties> = {
  이지: {
    background: 'linear-gradient(180deg,#aab4bc,#7d8891)',
    border: '1px solid #67717a',
    color: '#f5f6f7',
    textShadow: '0 1px 1px rgba(0,0,0,.3)',
  },
  노멀: {
    background: 'linear-gradient(180deg,#5cc2dd,#2b93b0)',
    border: '1px solid #1f7690',
    color: '#ffffff',
    textShadow: '0 1px 1px rgba(0,0,0,.25)',
  },
  하드: {
    background: 'linear-gradient(180deg,#e784a6,#c04b74)',
    border: '1px solid #9c3a5c',
    color: '#ffffff',
    textShadow: '0 1px 1px rgba(0,0,0,.25)',
  },
  카오스: {
    background: 'linear-gradient(180deg,#3c3c3c,#221f1f)',
    border: '1px solid #caa87f',
    color: '#f0d8b8',
  },
  익스트림: {
    background: 'linear-gradient(180deg,#3c3c3c,#1c1414)',
    border: '1.5px solid #ef5d78',
    color: '#f4794f',
  },
}

export function DifficultyBadge(props: { difficulty: BossDifficulty }): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center rounded-full text-[10px] font-extrabold tracking-[.03em]"
      style={{ height: '20px', padding: '0 10px', ...DIFFICULTY_BADGE_STYLES[props.difficulty] }}
    >
      {props.difficulty}
    </span>
  )
}

// 난이도 약자(ADR-040) — 좁은 아이템 타일에 여러 난이도를 겹쳐 표시하기 위한 간소화 표기.
const DIFFICULTY_ABBR: Record<BossDifficulty, string> = {
  이지: '이',
  노멀: '노',
  하드: '하',
  카오스: '카',
  익스트림: '익',
}

// 간소화 난이도 뱃지(ADR-040) — '어느 난이도에서 뜨는지'를 약자 + 난이도색 칩으로 표시한다.
// 약자만으론 스크린리더에 무의미해 장식 정보로 aria-hidden 처리(타일 접근명은 아이템명 유지).
export function DifficultyChip(props: { difficulty: BossDifficulty }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded text-[9px] font-extrabold leading-none"
      style={{
        height: '14px',
        minWidth: '14px',
        padding: '0 3px',
        ...DIFFICULTY_BADGE_STYLES[props.difficulty],
      }}
    >
      {DIFFICULTY_ABBR[props.difficulty]}
    </span>
  )
}
