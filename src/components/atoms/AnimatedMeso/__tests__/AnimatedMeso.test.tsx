// 웹판과 같은 두 가지를 지킨다 — **숫자만 낸다**는 것과 **숫자와 단위 사이 공백 문자**([[ADR-046]]).
//
// 굴러가는 동작 자체(재조준·마운트 기억·identity 교체 — [[ADR-087]] 결정 6·7·8, 정정 1)는 여기서
// 다시 세우지 않는다. 그 계약은 `packages/core` 의 `use-count-up.test.tsx` 가 이미 지키고, RN 은
// **같은 훅을 그대로 부른다**(CSS 가 아니라 rAF 기반이라 옮길 것이 없었다 — 컴포넌트 주석 참고).
import { clearCountUpMemory } from '../../../../lib/use-count-up'
import { Text } from 'react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { AnimatedMeso } from '../AnimatedMeso'

afterEach(clearCountUpMemory)

describe('AnimatedMeso', () => {
  it('천 단위 구분 기호가 붙은 숫자만 낸다 — 단위도 요소도 만들지 않는다', async () => {
    const { getByTestId } = await renderAtom(
      <Text testID="money">
        <AnimatedMeso identity="a" value={1_284_500_000} /> 메소
      </Text>,
    )

    // Fragment 라 요소가 늘지 않는다 — 렌더된 자식은 문자열 둘뿐이다. 요소가 하나라도 끼면
    // 호출부의 배지 위치 기준·텍스트 규약이 무너진다.
    expect(getByTestId('money').children).toEqual(['1,284,500,000', ' 메소'])
  })

  it('숫자와 단위 사이의 실제 공백 문자가 살아 있다 ([[ADR-046]])', async () => {
    const { getByTestId } = await renderAtom(
      <Text testID="money">
        <AnimatedMeso identity="a" value={0} /> 메소
      </Text>,
    )

    expect(getByTestId('money').children.join('')).toBe('0 메소')
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect(
      (
        await renderAtom(
          <Text>
            <AnimatedMeso identity="snapshot" value={1_284_500_000} /> 메소
          </Text>,
        )
      ).toJSON(),
    ).toMatchSnapshot()
  })
})
