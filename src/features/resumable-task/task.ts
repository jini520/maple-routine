/**
 * 이어서 하는 작업의 정의. 앱이 중간에 닫혀도 다시 열 때 남은 것부터 한다.
 *
 * @see docs/foundation/error-resilience.md 앱이 중간에 닫혀도 끝나는 작업
 */

/** 배지 아이콘. 그림은 화면이 고른다(기능 층은 부품을 모른다). */
export type TaskIcon = 'crown' | 'users'

export interface TaskStep {
  label: string
  /** 단계 이름 아래 작은 줄 */
  sub?: string
  /** 남은 일의 수 */
  remaining: () => Promise<number>
  /**
   * 남은 일의 앞쪽 `limit` 개를 트랜잭션 하나로 처리하고 처리한 수를 돌려준다. `limit` 보다 적으면 그 단계가 끝난 것이다.
   * 처리한 일은 다시 남은 일로 잡히면 안 된다. 그래야 멈춘 자리를 적지 않아도 이어서 한다.
   */
  runChunk: (limit: number) => Promise<number>
}

export interface ResumableTask {
  /** 끝나지 않은 작업 표시에 적히는 이름. 바꾸면 옛 표시를 못 찾는다 */
  id: string
  /** 재진행 확인의 작업 줄 */
  name: string
  /** 진행률 모달의 제목. `…하고 있어요` */
  title: string
  icon: TaskIcon
  /** 건수의 단위. 기본 `건` */
  unit?: string
  steps: TaskStep[]
  /** 완료 토스트. 처리한 수를 받는다 */
  doneToast: (count: number) => string
}
