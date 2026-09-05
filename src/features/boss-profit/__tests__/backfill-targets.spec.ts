// 어느 (캐릭터, 기간)을 조회할 것인가. 순수 함수라 저장소 없이 그대로 부른다.
import { buildBackfillTargets } from '../backfill'

// 2026-09-05(토). 이번 주는 09-03, 이번 달은 2026-09.
const NOW = new Date('2026-09-05T12:00:00+09:00')
const OCIDS = ['o1', 'o2']

const keys = (targets: ReturnType<typeof buildBackfillTargets>): string[] => [
  ...new Set(targets.map((t) => `${t.cycle}|${t.periodKey}`)),
]

describe('주간 탭', () => {
  it('그 주와 **그 주가 속한 달**을 함께 조회한다', () => {
    expect(keys(buildBackfillTargets('weekly', '2026-08-20', OCIDS, NOW))).toEqual([
      'weekly|2026-08-20',
      'monthly|2026-08',
    ])
  })

  it('캐릭터마다 한 벌씩 만든다', () => {
    expect(buildBackfillTargets('weekly', '2026-08-20', OCIDS, NOW)).toHaveLength(4)
  })

  // 주가 속한 달은 그 주의 목요일 기준이다. 8/27 주는 9/1~9/2 를 품지만 8월이다.
  it('달 경계를 걸친 주도 목요일이 속한 달을 본다', () => {
    expect(keys(buildBackfillTargets('weekly', '2026-08-27', OCIDS, NOW))).toContain('monthly|2026-08')
  })
})

describe('월간 탭', () => {
  it('그 달과 그 달의 지난 주차들을 조회한다', () => {
    expect(keys(buildBackfillTargets('monthly', '2026-08', OCIDS, NOW))).toEqual([
      'monthly|2026-08',
      'weekly|2026-08-06',
      'weekly|2026-08-13',
      'weekly|2026-08-20',
      'weekly|2026-08-27',
    ])
  })
})
