/**
 * 2겹 스플래시의 색. 일러스트에서 뽑은 값이라 테마 토큰이 아니다. 테마는 라이트 · 다크를 가르는 데만 쓴다.
 *
 * `sky` 는 1겹(`app.json` 의 `expo-splash-screen` · 안드로이드 `colors.xml` 둘 · iOS colorset · storyboard)의 색과
 * 같아야 한다. 다르면 1겹이 걷히는 순간 색이 끊긴다.
 */
import type { ThemeMode } from '../../types/theme'

export interface SplashColors {
  /** 그라디언트 맨 위 */
  sky: string
  /** `groundAt` 부터 바닥까지 */
  ground: string
  /** 하늘이 땅으로 다 바뀌는 자리. 화면 높이에 대한 비율 */
  groundAt: number
  /** 이름 글자 */
  ink: string
}

export const SPLASH_COLORS: Record<ThemeMode, SplashColors> = {
  light: { sky: '#B9CDF4', ground: '#E9F0FD', groundAt: 0.6, ink: '#2B3A66' },
  dark: { sky: '#0B1022', ground: '#1F2A50', groundAt: 0.6, ink: '#EEF3FF' },
}
