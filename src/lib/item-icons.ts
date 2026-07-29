import bossRingBoxesData from '../data/boss-ring-boxes.json'
import itemIconsData from '../data/item-icons.json'

// ADR-011 결정 6 / ADR-038 결정 4: "이름 → 파일명 계산"이 아니라 "매핑 테이블에서 조회, 없으면
// 폴백(null)". 반지·일반 아이템 모두 `iconFile`(전체 파일명)로 명시 매핑돼 있으므로 링 접미사
// 휴리스틱 대신 `iconFile` 값을 직접 쓴다. 반지 파일은 `items/rings/`, 나머지는 `items/`.

interface ItemIconEntry {
  name: string
  iconFile?: string
  iconFileBySlot?: Record<string, string>
}

// 파일명(NFC) → 번들 URL. items/ 와 items/rings/ 를 한 맵으로 합친다(파일명이 겹치지 않음).
const itemModules = import.meta.glob('../assets/items/*.{png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const ringModules = import.meta.glob('../assets/items/rings/*.{png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// macOS는 한글 파일명을 NFD로 저장 — 저장/조회 양쪽을 NFC로 정규화(boss-icons.ts와 동일).
const urlsByFileName: Record<string, string> = {}
for (const [path, url] of [...Object.entries(itemModules), ...Object.entries(ringModules)]) {
  const fileName = path.slice(path.lastIndexOf('/') + 1).normalize('NFC')
  urlsByFileName[fileName] = url
}

// 아이템명(NFC) → iconFile(string) | iconFileBySlot(Record<slot, file>).
type IconMapping = string | Record<string, string>
const iconByName: Record<string, IconMapping> = {}

// 반지(boss-ring-boxes)를 먼저 넣고 item-icons가 덮어써 우선한다 — '생명의 연마석'은 반지 표에선
// iconFile이 null이고 item-icons의 whetstone_life.png가 실제 아이콘이라 후자가 이겨야 한다.
for (const box of bossRingBoxesData.boxes) {
  for (const ring of box.itemProbabilities) {
    if (ring.iconFile) {
      iconByName[ring.name.normalize('NFC')] = ring.iconFile
    }
  }
}
for (const item of itemIconsData.items as ItemIconEntry[]) {
  if (item.iconFileBySlot !== undefined) {
    iconByName[item.name.normalize('NFC')] = item.iconFileBySlot
  } else if (item.iconFile !== undefined) {
    iconByName[item.name.normalize('NFC')] = item.iconFile
  }
}

// '기타'(ADR-041): 백옥 반지 상자 목록 밖 저가치 반지 묶음. 실재 아이템명이 아닌 UI 전용이라
// item-icons.json(정합성 테스트가 드랍테이블 실재를 강제)이 아니라 런타임 맵에만 특수 매핑한다.
// 리밋 링 아이콘(items/rings/Limit_Ring.webp)을 재사용.
iconByName['기타'.normalize('NFC')] = 'Limit_Ring.webp'

/**
 * 아이템명(+슬롯)으로 아이콘 URL을 조회한다. 매핑/파일이 없으면 null(호출부에서 플레이스홀더 폴백).
 * `iconFileBySlot` 매핑(현재 데이터엔 없음)은 slot이 있어야 특정 가능하다.
 */
export function getItemIconUrl(name: string, slot?: string): string | null {
  const mapping = iconByName[name.normalize('NFC')]
  if (mapping === undefined) return null

  const fileName =
    typeof mapping === 'string' ? mapping : slot === undefined ? undefined : mapping[slot]
  if (fileName === undefined) return null

  return urlsByFileName[fileName.normalize('NFC')] ?? null
}

/**
 * 파일명으로 직접 아이콘 URL을 조회한다. 실재 아이템명이 아닌 표시전용 아이콘(솔 에르다 단위
 * 분해 등)에 쓴다 — 이런 파일은 item-icons.json 매핑 없이 파일명으로만 참조된다.
 */
export function getItemIconUrlByFile(fileName: string): string | null {
  return urlsByFileName[fileName.normalize('NFC')] ?? null
}
