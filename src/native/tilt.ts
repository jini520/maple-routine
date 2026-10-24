import { getTiltPort, type Tilt } from './ports'

export type { Tilt }

/**
 * 폰 기울기 구독. 고가 드롭 카드의 홀로그램 빛이 부른다.
 *
 * @returns 해제 함수. 언마운트에서 부르지 않으면 센서가 계속 돈다.
 */
export function subscribeTilt(listener: (tilt: Tilt) => void): () => void {
  return getTiltPort().subscribe(listener)
}
