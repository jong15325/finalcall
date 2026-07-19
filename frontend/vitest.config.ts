import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * 테스트 러너 설정(FC-051 → FC-055 이관).
 *
 * ★ **`vite.config.ts` 에 test 블록을 합치지 않고 분리한다.** 그 파일에는 dev 프록시의
 * `X-Gateway-Token` 주입(D-068)이 들어 있고, 빠뜨리면 화면 전체가 `GATEWAY_403` 으로만 보인다 —
 * 실제로 한 번 그렇게 나간 전력이 있는 지뢰다. 테스트 설정을 만질 때마다 그 파일을 여는 구조를
 * 만들지 않는다.
 *
 * 대신 `mergeConfig` 로 vite 설정을 **그대로 상속**한다 — `@/` alias·react 플러그인이 한 곳에만
 * 존재해 두 벌 관리로 갈라지지 않는다. vitest 는 dev 서버를 띄우지 않으므로 상속된 `server.proxy`
 * 는 테스트에서 무해하다(네트워크는 각 테스트가 `fetch` 를 stub 해 차단한다).
 */
export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: 'jsdom',
            globals: false, // 전역 주입 없이 'vitest' 에서 명시 import — tsconfig types 추가 불요
            setupFiles: ['./src/test/setup.ts'],
            include: ['src/**/*.test.{ts,tsx}'],
            css: false, // Tailwind 클래스는 문자열로만 검증한다. PostCSS 파이프라인은 렌더에 불필요
            restoreMocks: true,
            unstubGlobals: true,
        },
    }),
)
