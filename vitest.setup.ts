// vaul(Drawer)은 Radix 기반이라 jsdom에 없는 브라우저 API를 요구한다(ADR-039).
// 전역 test env가 'node'이고 컴포넌트 테스트만 파일 주석으로 jsdom을 켜므로, 이 setupFiles는
// node 환경에서도 로드된다 — window/Element 가드로 감싸 node-env 테스트를 깨뜨리지 않는다.

if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  // jsdom 에는 요소 스크롤 API 가 없다. 화면이 자기 스크롤 컨테이너를 소유하면서([[ADR-099]])
  // 제품 코드가 `container.scrollTo(...)` 를 부른다 — 테스트는 이 스텁을 spy 로 덮어 검증한다.
  Element.prototype.scrollTo ??= () => {}
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

if (typeof globalThis !== 'undefined' && typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof globalThis.ResizeObserver
}
