import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import dynamicImport from 'vite-plugin-dynamic-import'

// https://vitejs.dev/config/
export default defineConfig({
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
    // ★ X-Gateway-Token 주입이 필수다(D-068). 백엔드는 `gateway.internal.enforced=true` 라
    //   엣지 게이트웨이가 부착하는 공유비밀이 없는 요청을 GATEWAY_403 으로 막는다. dev 에서는
    //   SCG 를 띄우지 않으므로 이 프록시가 게이트웨이 역할을 대신해 헤더를 붙인다.
    //   빠뜨리면 화면 전체가 에러 상태로만 보인다 — 실제로 한 번 그렇게 나갔다.
    //   값은 application-local.yml 의 기본값과 같아야 한다. 운영 비밀이 아니라 로컬 고정값이다.
    //
    //   ★★ Ecme 템플릿 원본은 이 프록시가 `:3000` 을 보며 헤더도 붙이지 않는다(FC-055).
    //      템플릿 설정을 그대로 덮어쓰면 그 지뢰를 다시 밟는다 — 아래 블록은 우리 것이 정본이다.
    server: {
        proxy: {
            '/api': {
                target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080',
                changeOrigin: true,
                secure: false,
                headers: {
                    'X-Gateway-Token':
                        process.env.VITE_DEV_GATEWAY_TOKEN ??
                        'finalcall-local-gateway-shared-secret-change-me',
                },
            },
        },
    },
    build: {
        outDir: 'build',
    },
})
