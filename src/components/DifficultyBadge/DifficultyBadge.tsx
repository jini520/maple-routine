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
