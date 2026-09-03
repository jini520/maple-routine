/**
 * 설정 계열 화면이 쓰는 이름. 몸통은 `app/use-screen-navigation.ts` 에 있다.
 *
 * 호출부가 설정만이 아니라 컨텐츠 스케줄러까지라 이름이 사실보다 좁다. 여기는 별칭만 남긴다.
 * 설정 화면 일곱과 그 테스트가 부르는 이름(`jest.mock('../use-settings-navigation')` 포함)을
 * 바꾸지 않기 위해서다.
 *
 * 두 벌로 두지 않는 것은 이 훅의 존재 이유가 `useNavigation` 의 제네릭 인자를 적는 자리를 하나로
 * 좁힌다 이기 때문이다. 두 벌이면 각자 자기 목록 안에서는 맞아 컴파일도 통과한다.
 */
import { useScreenNavigation, type ScreenNavigation } from '../use-screen-navigation'

export type SettingsNavigation = ScreenNavigation

export const useSettingsNavigation = useScreenNavigation
