/**
 * 설정 계열 화면이 쓰는 이름. **몸통은 `app/use-screen-navigation.ts` 로 올라갔다**.
 *
 * step 3 이 이 훅을 만들 때 호출부가 설정뿐이라 그 이름을 달았는데, 컨텐츠 스케줄러가 같은 것을
 * 필요로 하면서 이름이 사실과 어긋났다. 몸통을 옮기고 여기는 별칭만 남긴다. 설정 화면 일곱과
 * 그 테스트가 부르는 이름(`jest.mock('../use-settings-navigation')` 포함)을 바꾸지 않기 위해서다.
 *
 * **왜 두 벌로 두지 않는가**: 이 훅의 존재 이유가 *"`useNavigation` 의 제네릭 인자를 적는 자리를
 * 하나로 좁힌다"* 라, 두 벌이면 그 이유가 첫걸음부터 깨진다(각자 자기 목록 안에서는 맞아 컴파일도
 * 통과한다). 근거와 갈린 내용은 옮겨간 파일이 갖는다.
 */
import { useScreenNavigation, type ScreenNavigation } from '../use-screen-navigation'

export type SettingsNavigation = ScreenNavigation

export const useSettingsNavigation = useScreenNavigation
