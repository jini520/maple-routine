/**
 * 테마를 읽는 쪽의 API. 컨텍스트와 훅.
 *
 * 컴포넌트(`ThemeProvider`·`MediaScope`)와 **파일을 나눈 이유**는 fast refresh 다. 한 파일이
 * 컴포넌트와 값을 함께 export 하면 갱신 경계가 깨진다(`Button/variants.ts`·`row-class.ts` 와 같은
 * 판단). 여기 있는 것은 전부 값·훅이라 컴포넌트가 없다.
 */

import { createContext, useContext } from 'react'
import type { ThemeMode } from '../types/theme'

import type { ThemeAppearance } from './appearance-store'

/**
 * 프로바이더가 없다는 뜻의 `null` 초기값. 기본 테마로 조용히 폴백하지 않는다.
 *
 * 폴백을 두면 프로바이더를 빼먹은 화면이 **기본 테마로 잘 도는 것처럼 보이고**, 사용자가 고른 테마가
 * 어느 서브트리에서만 안 먹히는 것을 아무도 못 잡는다. `native/ports.ts` 의 슬롯이 주입 전 접근에
 * 던지는 것과 같은 판단이다.
 */
export const ThemeContext = createContext<ThemeAppearance | null>(null)

export function useThemeAppearance(): ThemeAppearance {
  const appearance = useContext(ThemeContext)
  if (appearance === null) {
    throw new Error('테마 컨텍스트가 없습니다. 화면을 <ThemeProvider> 안에 두세요.')
  }
  return appearance
}

/**
 * 라이트/다크.
 *
 * 테마 이름으로 분기하지 말고 이 값으로 분기할 것. 이름 목록(`DARK_THEMES`)은 테마가 늘 때마다
 * 목록을 고쳐야 하며 빠뜨리면 조용히 틀린다.
 *
 * 자리마다 조건문을 두는 것보다 파생 토큰으로 만드는 편이 낫다. 스크림 위 패널 테두리가 그
 * 예로, `theme-vars.ts` 가 `--color-panel-border` 를 미리 계산해 두어 호출부는
 * `border-panel-border` 만 쓴다. 이 훅은 그렇게 접히지 않는 자리(플랫폼 프롭 등)를 위한 것이다.
 */
export function useThemeMode(): ThemeMode {
  return useThemeAppearance().definition.mode
}

/**
 * 스크롤 인디케이터 명암.
 *
 * 플랫폼에 알려 줘야 한다. 안 걸면 라이트 테마에서 흰 인디케이터가 나온다. RN 에서는 우리가
 * `ScrollView` 에 프롭으로 지정한다.
 * 그래서 이 값은 포트가 아니라 뷰가 갖는다.
 *
 * `'default'` 를 쓰지 않는다. 플랫폼 기본에 맡기면 테마가 아니라
 * OS 설정을 따라간다. 우리 테마의 `mode` 가 정해야 한다.
 */
export function useScrollIndicatorStyle(): 'black' | 'white' {
  return useThemeMode() === 'dark' ? 'white' : 'black'
}

/**
 * 얹히는 흐림의 재질(`expo-blur` 의 `tint`). 시트의 단계 전환과 보스 수익 버튼의 드럼이 쓴다.
 *
 * 위 훅과 **같은 이유로 여기 있다**. `expo-blur` 의 기본값 `'default'` 는 iOS 에서
 * `UIBlurEffect.Style.regular` 이고, 그 재질은 트레잇의 `userInterfaceStyle` 을 따라가 **OS 가
 * 다크면 검게** 깔린다. 다크 OS 를 쓰는 사용자의 라이트 테마 시트가 통째로 어두워졌다.
 *
 * 여기서 내는 둘은 **고정** 재질이라 OS 를 안 본다. 흐려지는 것은 자기가 이미 입고 있는 색으로
 * 녹는다.
 */
export function useBlurTint(): 'systemMaterialLight' | 'systemMaterialDark' {
  return useThemeMode() === 'dark' ? 'systemMaterialDark' : 'systemMaterialLight'
}
