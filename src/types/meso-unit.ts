/** 금액 칸에서 치는 단위. 세그먼트 글자와 환산은 `MesoPad/meso-unit.ts` 가 정한다. */
export type MesoUnit = 'base' | 'man' | 'eok'

/**
 * 단위를 기억하는 칸 이름. 칸마다 따로 기억한다.
 *
 * 드롭 판매가에서 억을 골라도 개당 가격은 몇 만 메소를 치는 칸이라 따라오면 안 된다.
 */
export type MesoUnitKey = 'dropPrice' | 'itemSale' | 'itemBuy' | 'catalogUnitPrice' | 'itemSplit'
