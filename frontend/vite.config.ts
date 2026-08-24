import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import dynamicImport from 'vite-plugin-dynamic-import'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '')
    const devApiTarget =
        env.VITE_DEV_API_TARGET?.trim() || 'http://localhost:8080'
    const targetsLocalBackend =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(devApiTarget)
    const localGatewayHeaders = targetsLocalBackend
        ? {
              'X-Gateway-Token':
                  env.VITE_DEV_GATEWAY_TOKEN ??
                  'finalcall-local-gateway-shared-secret-change-me',
          }
        : undefined

    return {
        plugins: [react(), dynamicImport()],
        assetsInclude: ['**/*.md'],
        resolve: {
            alias: {
                '@': path.join(__dirname, 'src'),
            },
        },
        // 개발 프록시 — API base 는 동일 오리진 `/api/v1`(.env.example)이므로 dev 서버가 백엔드로 넘긴다.
        // 운영은 게이트웨이가 같은 경로를 담당하므로 클라이언트 코드는 무변경이다.
        //
        // ★ 로컬 백엔드 직결 시 X-Gateway-Token 주입이 필수다(D-068). 백엔드는 `gateway.internal.enforced=true` 라
        //   엣지 게이트웨이가 부착하는 공유비밀이 없는 요청을 GATEWAY_403 으로 막는다. dev 에서는
        //   SCG 를 띄우지 않으므로 이 프록시가 게이트웨이 역할을 대신해 헤더를 붙인다.
        //   빠뜨리면 화면 전체가 에러 상태로만 보인다 — 실제로 한 번 그렇게 나갔다.
        //   값은 application-local.yml 의 기본값과 같아야 한다. 운영 도메인을 target으로 쓰면 실제
        //   게이트웨이가 토큰을 관리하므로 개발 프록시는 이 내부 헤더를 보내지 않는다.
        //
        //   ★★ Ecme 템플릿 원본은 이 프록시가 `:3000` 을 보며 헤더도 붙이지 않는다(FC-055).
        //      템플릿 설정을 그대로 덮어쓰면 그 지뢰를 다시 밟는다 — 아래 블록은 우리 것이 정본이다.
        server: {
            proxy: {
                '/api': {
                    target: devApiTarget,
                    changeOrigin: true,
                    secure: false,
                    headers: localGatewayHeaders,
                },
                '/ws': {
                    target: devApiTarget,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                    headers: localGatewayHeaders,
                },
            },
        },
        build: {
            outDir: 'build',
            rollupOptions: {
                output: {
                    /*
                     * ★★ **덩치의 정체를 이름으로 고정한다**(FC-057).
                     *    244KB 청크가 `UserProfileDropdown-*.js` 라는 이름으로 나오는 바람에
                     *    **두 티켓이 연달아 오진**했다 — FC-055 는 firebase 로 봤고(제거해도 크기
                     *    그대로), FC-056 은 `react-icons/pi` 로 봤다(산출물에 아이콘 path 데이터가
                     *    0건이다). 실제 내용물은 **framer-motion** 이었다(`MotionValue`·`projection`
                     *    식별자로 확인). 이름이 내용을 가리키면 세 번째 오진이 없다.
                     *
                     * ★ FC-057 시점에는 **framer-motion 이 번들에 아예 없다.** 셸이 그것을 끌어들이던
                     *   경로(`ui/Avatar` 배럴 → `AvatarGroup` → `ui/Tooltip` → framer-motion)를
                     *   끊었기 때문이다(`AppShell/AccountMenu.tsx` 주석). 그래서 이 설정은 지금
                     *   **아무 청크도 만들지 않는다.**
                     *   그래도 남겨두는 이유: 템플릿 UI 킷의 Dialog·Drawer·Alert·Tooltip·toast 가
                     *   전부 framer-motion 을 쓰므로 **다음 화면 티켓에서 언제든 돌아온다.** 그때
                     *   덩치가 다시 엉뚱한 이름을 뒤집어쓰지 않게 미리 붙여둔 라벨이다.
                     *
                     * ★ **함수 형태를 쓴다.** 배열 형태(`{'vendor-motion': ['framer-motion']}`)는
                     *   빈 그룹일 때도 청크 경계를 만들어 산출물이 달라진다. 함수는 해당 모듈이
                     *   그래프에 없으면 조용히 무동작이다.
                     */
                    manualChunks(id: string) {
                        if (id.includes('node_modules/framer-motion')) {
                            return 'vendor-motion'
                        }
                        return undefined
                    },
                },
            },
        },
    }
})
