/**
 * 저장 순서가 곧 표시 순서다. 추적 목록(`trackedCharacters`)의 배열
 * 순서를 화면 목록에 얹는다.
 *
 * ## 왜 core 스토어를 안 고치고 화면 쪽에서 얹는가
 *
 * 컨텐츠·보스 스토어는 `sortByCachedLevel`(레벨 내림차순)로 목록을 정렬하고
 * **Capacitor 앱이 그 정렬로 산다.** 거기서 저장 배열 순서 로 바꾸면 웹뷰 앱의 화면 순서까지
 * 함께 바뀌어 이 개편의 적용 범위(RN 만)를 넘는다. 그래서 core 는 **안정된 기준 순서를 그대로
 * 내고**, RN 이 그 배열을 이 함수 하나로 다시 세운다.
 *
 * 플래그를 하나 더 만들지 않는 것이 요점이다.
 * **Capacitor 가 걷히면 이 함수는 core 정렬 안으로 흡수된다.**
 *
 * ## 목록에 없는 항목을 버리지 않는다
 *
 * 저장 목록과 스토어 목록은 한순간 어긋날 수 있다. 저장 직후(스토어가 아직 옛 목록) · 동기화가
 * 캐시 단계와 응답 단계를 두 번 커밋하는 사이. 그때 `orderedOcids` 에 없다고 버리면 **캐릭터가
 * 화면에서 통째로 사라진다.** 순서를 정하는 함수가 목록의 크기를 바꾸면 안 된다. 그래서 모르는
 * 항목은 뒤에 원래 순서로 남긴다(순서가 늦게 오는 것과 카드가 없어지는 것은 대가가 다르다).
 *
 * 반대로 `orderedOcids` 에만 있고 화면에 없는 ocid 는 자리를 만들지 않는다. 이 함수가 아는 것은
 * 순서뿐이고, 없는 캐릭터를 그릴 재료는 갖고 있지 않다.
 */
export function orderByTracked<T extends { ocid: string }>(items: T[], orderedOcids: string[]): T[] {
  // 같은 ocid 가 두 번 오면 **먼저 나온 자리**를 그 ocid 의 순위로 삼는다.
  const rankByOcid = new Map<string, number>()
  for (const [index, ocid] of orderedOcids.entries()) {
    if (!rankByOcid.has(ocid)) rankByOcid.set(ocid, index)
  }

  return items
    .map((item, index) => ({
      item,
      index,
      rank: rankByOcid.get(item.ocid) ?? Number.POSITIVE_INFINITY,
    }))
    // 동순위(모르는 항목끼리 · 겹친 ocid 끼리)는 입력 순서로 가른다. 정렬의 안정성에 기대지 않고
    // 인덱스를 직접 비교하는 이유는 `Infinity - Infinity` 가 `NaN` 이라 뺄셈 한 줄로는 못 쓰기
    // 때문이고, 덤으로 **동순위의 순서** 가 엔진 성질이 아니라 이 파일의 계약이 된다.
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map((entry) => entry.item)
}
