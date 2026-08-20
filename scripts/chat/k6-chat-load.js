import http from 'k6/http'
import ws from 'k6/ws'
import { check, fail, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { SharedArray } from 'k6/data'

const fixturePath = __ENV.CHAT_FIXTURE_FILE || './chat-load-fixtures.json'
const fixtures = new SharedArray('chat-load-fixtures', () => {
    const parsed = JSON.parse(open(fixturePath))
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
        throw new Error('CHAT_FIXTURE_FILE의 users가 비어 있습니다.')
    }
    return parsed.users
})

const baseUrls = csvEnv('CHAT_BASE_URLS', __ENV.CHAT_BASE_URL || 'http://host.docker.internal:8080')
const websocketUrls = csvEnv('CHAT_WS_URLS', __ENV.CHAT_WS_URL || 'ws://host.docker.internal:8080/ws/chat')
const origin = __ENV.CHAT_ORIGIN || 'http://localhost:5173'
const gatewayToken = __ENV.CHAT_GATEWAY_TOKEN || ''
const forwardClientIp = (__ENV.CHAT_FORWARD_CLIENT_IP || 'false').toLowerCase() === 'true'
const mode = __ENV.CHAT_MODE || 'sustained'
const socketHold = __ENV.CHAT_SOCKET_HOLD || '10m'
const reconnectHold = __ENV.CHAT_RECONNECT_HOLD || '1s'

const writeDuration = new Trend('chat_write_duration', true)
const websocketConnectDuration = new Trend('chat_websocket_connect_duration', true)
const writeSuccess = new Rate('chat_write_success')
const websocketConnected = new Rate('chat_websocket_connected')
const websocketEvents = new Counter('chat_websocket_events')
const invalidEvents = new Counter('chat_websocket_invalid_events')
const websocketRemoteCloses = new Counter('chat_websocket_remote_closes')

validateFixtureCapacity()

export const options = {
    scenarios: scenarios(mode),
    thresholds: thresholds(mode),
    noConnectionReuse: false,
    userAgent: 'finalcall-chat-fc329-k6',
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
}

export function socketScenario() {
    const fixture = socketFixture()
    runSocket(fixture, socketHold)
}

function runSocket(fixture, holdDuration) {
    const startedAt = Date.now()
    let stompConnected = false
    let clientCloseRequested = false
    const response = ws.connect(endpointFor(websocketUrls), {
        headers: edgeHeaders(fixture),
        tags: { workload: 'socket' },
    }, (socket) => {
        socket.on('open', () => {
            socket.send(stompFrame('CONNECT', {
                'accept-version': '1.2',
                'heart-beat': '10000,10000',
                Authorization: `Bearer ${fixture.accessToken}`,
                host: 'finalcall',
            }))
        })
        socket.on('message', (raw) => {
            const frame = String(raw)
            if (frame.startsWith('CONNECTED')) {
                if (!stompConnected) websocketConnected.add(true)
                stompConnected = true
                websocketConnectDuration.add(Date.now() - startedAt)
                socket.send(stompFrame('SUBSCRIBE', {
                    id: `chat-${__VU}`,
                    destination: '/user/queue/chat.events',
                    ack: 'auto',
                }))
                return
            }
            if (frame.startsWith('MESSAGE')) {
                websocketEvents.add(1)
                if (!validEvent(stompBody(frame))) invalidEvents.add(1)
            }
        })
        socket.on('close', () => {
            if (!clientCloseRequested) websocketRemoteCloses.add(1)
        })
        socket.setInterval(() => socket.send('\n'), 10_000)
        socket.setTimeout(() => {
            clientCloseRequested = true
            socket.close()
        }, durationMillis(holdDuration))
    })
    if (!stompConnected) websocketConnected.add(false)
    check(response, { 'WebSocket HTTP upgrade 101': (result) => result?.status === 101 })
}

export function writeScenario() {
    const fixture = writeFixture()
    const roomPublicId = fixture.roomPublicIds[(__ITER + __VU) % fixture.roomPublicIds.length]
    const clientMessageId = uuidV4()
    const body = JSON.stringify({
        clientMessageId,
        body: `FC-323 ${__VU}/${__ITER} ${Date.now()}`,
    })
    const startedAt = Date.now()
    const response = http.post(
        `${endpointFor(baseUrls)}/api/v1/me/chat-rooms/${encodeURIComponent(roomPublicId)}/messages`,
        body,
        {
            headers: {
                ...edgeHeaders(fixture),
                Authorization: `Bearer ${fixture.accessToken}`,
                'Content-Type': 'application/json',
            },
            tags: { workload: execScenarioName() },
        },
    )
    const success = response.status === 201
    writeDuration.add(Date.now() - startedAt)
    writeSuccess.add(success)
    check(response, {
        'message write 201': () => success,
        'ApiResponse data 존재': () => response.json('data.message.roomSequence') > 0,
    })
}

export function reconnectScenario() {
    runSocket(socketFixture(), reconnectHold)
    sleep(Math.random() * 2)
}

function scenarios(selectedMode) {
    const all = {
        sockets: {
            executor: 'constant-vus',
            exec: 'socketScenario',
            vus: numberEnv('CHAT_SOCKET_VUS', 20_000),
            duration: __ENV.CHAT_SOCKET_DURATION || '10m',
            gracefulStop: '15s',
        },
        socketOnce: {
            executor: 'per-vu-iterations',
            exec: 'socketScenario',
            vus: numberEnv('CHAT_SOCKET_VUS', 1),
            iterations: 1,
            maxDuration: __ENV.CHAT_SOCKET_MAX_DURATION || '2m',
        },
        sustained: {
            executor: 'constant-arrival-rate',
            exec: 'writeScenario',
            rate: numberEnv('CHAT_SUSTAINED_RATE', 300),
            timeUnit: '1s',
            duration: __ENV.CHAT_SUSTAINED_DURATION || '5m',
            preAllocatedVUs: numberEnv('CHAT_SUSTAINED_PRE_VUS', 300),
            maxVUs: numberEnv('CHAT_SUSTAINED_MAX_VUS', 2_000),
        },
        burst: {
            executor: 'constant-arrival-rate',
            exec: 'writeScenario',
            rate: numberEnv('CHAT_BURST_RATE', 1_000),
            timeUnit: '1s',
            duration: __ENV.CHAT_BURST_DURATION || '60s',
            preAllocatedVUs: numberEnv('CHAT_BURST_PRE_VUS', 1_000),
            maxVUs: numberEnv('CHAT_BURST_MAX_VUS', 4_000),
        },
        reconnect: {
            executor: 'constant-vus',
            exec: 'reconnectScenario',
            vus: numberEnv('CHAT_RECONNECT_VUS', 1_000),
            duration: __ENV.CHAT_RECONNECT_DURATION || '2m',
            gracefulStop: '15s',
        },
    }
    if (selectedMode === 'all') {
        return {
            sockets: all.sockets,
            sustained: all.sustained,
            burst: all.burst,
            reconnect: all.reconnect,
        }
    }
    if (selectedMode === 'socket') return { sockets: all.sockets }
    if (selectedMode === 'socket-once') return { socketOnce: all.socketOnce }
    if (selectedMode === 'sustained') return { sustained: all.sustained }
    if (selectedMode === 'burst') return { burst: all.burst }
    if (selectedMode === 'reconnect') return { reconnect: all.reconnect }
    throw new Error(`지원하지 않는 CHAT_MODE입니다: ${selectedMode}`)
}

function thresholds(selectedMode) {
    const result = { checks: ['rate>0.99'] }
    if (['sustained', 'burst', 'all'].includes(selectedMode)) {
        result.chat_write_success = ['rate>0.99']
        result.chat_write_duration = ['p(95)<200', 'p(99)<500']
    }
    if (['socket', 'socket-once', 'reconnect', 'all'].includes(selectedMode)) {
        result.chat_websocket_connected = ['rate>0.99']
    }
    return result
}

function socketFixture() {
    const socketsPerUser = numberEnv('CHAT_SOCKETS_PER_USER', 3)
    const userIndex = Math.floor((__VU - 1) / socketsPerUser)
    if (userIndex >= fixtures.length) {
        fail(`socket quota용 사용자가 부족합니다. 필요=${Math.ceil(__ENV.CHAT_SOCKET_VUS / socketsPerUser)}`)
    }
    return fixtures[userIndex]
}

function validateFixtureCapacity() {
    const socketsPerUser = numberEnv('CHAT_SOCKETS_PER_USER', 3)
    let concurrentSockets = 0
    if (['socket', 'socket-once', 'all'].includes(mode)) {
        const defaultSocketVus = mode === 'socket-once' ? 1 : 20_000
        concurrentSockets = Math.max(concurrentSockets, numberEnv('CHAT_SOCKET_VUS', defaultSocketVus))
    }
    if (['reconnect', 'all'].includes(mode)) {
        concurrentSockets = Math.max(concurrentSockets, numberEnv('CHAT_RECONNECT_VUS', 1_000))
    }
    const requiredUsers = Math.ceil(concurrentSockets / socketsPerUser)
    if (fixtures.length < requiredUsers) {
        throw new Error(`socket quota용 사용자가 부족합니다. 필요=${requiredUsers}, 실제=${fixtures.length}`)
    }
}

function writeFixture() {
    const fixture = fixtures[(__VU + __ITER - 1) % fixtures.length]
    if (!Array.isArray(fixture.roomPublicIds) || fixture.roomPublicIds.length === 0) {
        fail('write fixture에는 roomPublicIds가 한 개 이상 필요합니다.')
    }
    return fixture
}

function edgeHeaders(fixture) {
    const headers = { Origin: origin }
    if (gatewayToken.length > 0) headers['X-Gateway-Token'] = gatewayToken
    if (forwardClientIp) {
        if (typeof fixture.clientIp !== 'string' || fixture.clientIp.length === 0) {
            fail('CHAT_FORWARD_CLIENT_IP=true이면 각 fixture에 clientIp가 필요합니다.')
        }
        headers['X-Forwarded-For'] = fixture.clientIp
    }
    return headers
}

function endpointFor(endpoints) {
    return endpoints[(__VU - 1) % endpoints.length].replace(/\/$/, '')
}

function stompFrame(command, headers) {
    const lines = [command]
    for (const [name, value] of Object.entries(headers)) lines.push(`${name}:${value}`)
    return `${lines.join('\n')}\n\n\0`
}

function stompBody(frame) {
    const separator = frame.indexOf('\n\n')
    if (separator < 0) return ''
    return frame.slice(separator + 2).replace(/\0$/, '')
}

function validEvent(body) {
    try {
        const event = JSON.parse(body)
        return typeof event.eventId === 'string'
            && event.eventVersion === 1
            && typeof event.roomPublicId === 'string'
            && ['MESSAGE_CREATED', 'READ_UPDATED', 'BLOCK_CHANGED'].includes(event.eventType)
            && typeof event.payload === 'object'
            && event.payload !== null
    } catch (_) {
        return false
    }
}

function uuidV4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16)
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return value.toString(16)
    })
}

function numberEnv(name, fallback) {
    const value = Number(__ENV[name] || fallback)
    if (!Number.isFinite(value) || value <= 0) fail(`${name}은 양수여야 합니다.`)
    return value
}

function csvEnv(name, fallback) {
    const values = String(__ENV[name] || fallback)
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    if (values.length === 0) fail(`${name}에는 endpoint가 한 개 이상 필요합니다.`)
    return values
}

function durationMillis(value) {
    const match = /^(\d+)(ms|s|m|h)$/.exec(value)
    if (!match) fail(`지원하지 않는 duration입니다: ${value}`)
    const multiplier = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }[match[2]]
    return Number(match[1]) * multiplier
}

function execScenarioName() {
    return __ENV.CHAT_MODE || 'sustained'
}
