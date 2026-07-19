/**
 * 게임 카드 아트 동기화 (FC-049).
 *
 * ★ **왜 복사인가** — React/Vite 는 프로젝트 루트(`frontend/`) 밖 파일을 번들·서빙하지 못한다.
 * 자산 정본은 `docs/game_ui/**`(레포 공용, 디자인·백엔드도 참조)이므로 그 원본을 옮기지 않고
 * **빌드 산출물 쪽으로 복사**한다. 복사본(`public/art/`)은 `.gitignore` 대상이라 바이너리가
 * 레포에 이중 등재되지 않는다 — 정본은 언제나 `docs/game_ui` 한 곳뿐이다.
 *
 * ★ **왜 전량인가** — 도달 가능한 조합이 곧 전량이다.
 *   level 1~9 × {l,s} × element 1~4 × kind 9종 = 648장.
 *   시드(FC-052) 템플릿 40종은 element×kind 조합 전수(무기 16 · 방어구 16 · 마법 8)이고,
 *   `item_instance.level` 은 인스턴스마다 1~9로 흩어진다. 즉 "시드가 쓰는 조합"으로 좁혀도
 *   그 결과가 전량이라 부분 복사가 성립하지 않는다(레벨을 고정해야만 줄어드는데 그건 데이터 왜곡이다).
 *   총 4.1MB 정적 파일이며 **번들에 들어가지 않는다**(브라우저는 화면에 뜬 카드 수만큼만 받는다).
 *
 * 실행: `npm run dev` / `npm run build` 의 pre 스크립트가 자동 호출한다.
 */
import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** 자산 정본(레포 공용). 여기를 편집하지 않는다 — 읽기 전용 원본이다. */
const SOURCE = resolve(here, '../../docs/game_ui/item_info/card_image/gold_black');
/** 복사 대상. `features/item/lib/itemArt.ts` 의 `ART_BASE` 와 짝을 맞춘다. */
const TARGET = resolve(here, '../public/art/items');

async function main() {
  try {
    await access(SOURCE);
  } catch {
    // 자산이 없어도 빌드를 세우지 않는다 — 아트는 화면의 필수 골격이 아니라 장식이고,
    // ItemArtSlot 이 자산 부재를 플레이스홀더로 흡수한다(design-system [5.3]).
    console.warn(`[game-art] 원본을 찾지 못해 건너뜁니다: ${SOURCE}`);
    return;
  }

  await mkdir(dirname(TARGET), { recursive: true });
  await cp(SOURCE, TARGET, { recursive: true });
  console.log(`[game-art] 동기화 완료 → ${TARGET}`);
}

await main();
