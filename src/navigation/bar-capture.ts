/**
 * 하단바 렌즈가 뒤에 비칠 화면을 뜨려고 `LayerStack` 과 바가 나눠 쓰는 자리.
 *
 * `LayerStack` 이 화면 상자와 가림 여부를 채우고, 바가 다시 보일 때 부를 함수를 채운다. 바는 `LayerStack` 의 `layout`
 * 안에 그려져 그 상자의 ref 를 프롭으로 받을 수 없다.
 */
import type { RefObject } from 'react'
import type { View } from 'react-native'

export const pageCapture: {
  /** 뜰 화면 상자. 유리 바는 이 상자 밖에 있다. 실기기에서 유리를 뜨면 하얗게 찍힌다. */
  ref: RefObject<View | null> | null
  /** 위 화면(설정 등)에 가려졌는가. 가려진 뷰를 뜨면 앱이 죽는다. */
  isCovered: () => boolean
  /** 바가 채운다. 이 화면이 다시 보일 때 그림을 새로 뜬다(설정에서 테마를 바꾸고 돌아올 때 등). */
  onFocus: (() => void) | null
} = { ref: null, isCovered: () => false, onFocus: null }

