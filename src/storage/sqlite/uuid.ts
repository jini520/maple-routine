/**
 * 행의 식별자를 **SQLite 가 만든다.** `INSERT` 안에 이 식을 끼워 쓴다.
 *
 * JS 에서 안 만드는 이유. `crypto` 가 전역에 없다(`react-native` 0.86 Core 도 `expo` 의 winter
 * 런타임도 안 심는다 - 확인 2026-10-08). `Math.random` 은 씨앗 품질을 모른다. 새 네이티브 모듈을
 * 들이면 지문이 바뀌어 스토어 빌드를 탄다. SQLite 는 이미 번들에 있어 OTA 로 간다.
 *
 * 난수원은 SQLite 의 `sqlite3_randomness()` 이고 unix VFS 가 `/dev/urandom` 에서 씨앗을 받는다.
 * Postgres 쪽의 `gen_random_uuid()` 와 같은 자리다.
 *
 * `-4` 와 `substr('89ab', …)` 는 버전 니블과 변종 비트다. 그것을 박아야 v4 로 읽히고, 그 대가로
 * 무작위 비트가 128 에서 122 로 줄어든다. 실측과 모양 검증은
 * `__tests__/uuid-real-sqlite.test.ts` 가 든다.
 *
 * @example await db.run(`INSERT INTO t (id, v) VALUES (${NEW_UUID_SQL}, ?)`, [v])
 */
export const NEW_UUID_SQL =
  "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2)" +
  " || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2)" +
  " || '-' || hex(randomblob(6)))"
