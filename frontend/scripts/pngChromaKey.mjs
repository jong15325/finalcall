/**
 * 크로마키 → 알파 변환 (FC-058 재작업 2차).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **왜 필요한가 — 아트 PNG 에 알파 채널이 없다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 원본 카드 아트는 전부 `depth8 / colorType2`(RGB, **알파 없음**)이고, 투명해야 할 자리에
 * `#0000FF` 크로마키가 **실제 파란 픽셀로** 들어 있다(§5.12 가 `out_line/*.png` 에 대해
 * 적어둔 관례와 동일). 그대로 렌더하면 **모서리에 파란 점**이 찍힌다.
 *
 * **실측 (648장 전수 디코드, 추정 아님):**
 * | 항목 | 결과 |
 * |---|---|
 * | 픽셀 포맷 | `depth8/colorType2` **648/648** (알파 채널 0장) |
 * | 크로마키가 **네 귀퉁이 1px씩**뿐 | **609**장 |
 * | 크로마키 **0개** | 39장 |
 * | 귀퉁이 **밖**에 크로마키가 있는 파일 | **0장** |
 *
 * ★ 그래서 `border-radius` 로 깎는 안(A)을 **버렸다.** N배 확대에서 귀퉁이 1px 은 N×N 블록이
 *   되는데, 그걸 원형으로 완전히 덮으려면 반경이 **1.41N** 은 돼야 하고 그만큼 **진짜 아트를
 *   같이 깎는다.** 게다가 크로마키가 없는 39장까지 애먼 손해를 본다.
 *   변환은 **정확히 그 픽셀만** 지운다 — 외과적이다.
 *
 * ★ **정본은 건드리지 않는다.** 읽기는 `docs/game_ui/**`, 쓰기는 `public/art/**`(gitignore)뿐이다.
 *
 * 의존성 0 — Node 내장 `zlib` 만 쓴다. PNG 는 컨테이너가 단순해서 디코더·인코더가 각각
 * 수십 줄이고, 이것 하나 때문에 `sharp`(네이티브 바이너리 수십 MB)를 받을 이유가 없다.
 */
import { deflateSync, inflateSync } from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** 크로마키 색 — 원본 관례(§5.12). */
export const CHROMA_KEY = { r: 0, g: 0, b: 255 }

function crc32(buf) {
    let crc = ~0
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i]
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
        }
    }
    return ~crc >>> 0
}

function chunk(type, data) {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length, 0)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc32(body), 0)
    return Buffer.concat([head, body, tail])
}

/** PNG → `{ width, height, channels, data }`. colorType 2(RGB)·6(RGBA)만 다룬다. */
function decode(buffer) {
    if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error('PNG 시그니처가 아니다')
    }

    let pos = 8
    let width = 0
    let height = 0
    let bitDepth = 0
    let colorType = 0
    const idat = []

    while (pos < buffer.length) {
        const length = buffer.readUInt32BE(pos)
        const type = buffer.toString('ascii', pos + 4, pos + 8)
        const data = buffer.subarray(pos + 8, pos + 8 + length)

        if (type === 'IHDR') {
            width = data.readUInt32BE(0)
            height = data.readUInt32BE(4)
            bitDepth = data[8]
            colorType = data[9]
            // 인터레이스(data[12])는 원본에 없다. 있으면 언필터 규칙이 달라지므로 막는다.
            if (data[12] !== 0) throw new Error('인터레이스 PNG 미지원')
        } else if (type === 'IDAT') {
            idat.push(data)
        } else if (type === 'IEND') {
            break
        }
        pos += 12 + length
    }

    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`미지원 포맷 depth=${bitDepth} colorType=${colorType}`)
    }

    const channels = colorType === 2 ? 3 : 4
    const stride = width * channels
    const raw = inflateSync(Buffer.concat(idat))
    const out = Buffer.alloc(height * stride)
    let read = 0

    for (let y = 0; y < height; y++) {
        const filter = raw[read++]
        for (let x = 0; x < stride; x++) {
            const cur = raw[read + x]
            const a = x >= channels ? out[y * stride + x - channels] : 0
            const b = y > 0 ? out[(y - 1) * stride + x] : 0
            const c =
                x >= channels && y > 0
                    ? out[(y - 1) * stride + x - channels]
                    : 0

            let value
            switch (filter) {
                case 0:
                    value = cur
                    break
                case 1:
                    value = cur + a
                    break
                case 2:
                    value = cur + b
                    break
                case 3:
                    value = cur + ((a + b) >> 1)
                    break
                case 4: {
                    // Paeth
                    const p = a + b - c
                    const pa = Math.abs(p - a)
                    const pb = Math.abs(p - b)
                    const pc = Math.abs(p - c)
                    value = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
                    break
                }
                default:
                    throw new Error(`알 수 없는 필터 ${filter}`)
            }
            out[y * stride + x] = value & 0xff
        }
        read += stride
    }

    return { width, height, channels, data: out }
}

/** RGBA 픽셀 버퍼 → PNG. 필터는 None(0) 고정 — 아트가 작아 압축 이득보다 단순함이 낫다. */
function encodeRGBA(width, height, rgba) {
    const stride = width * 4
    const raw = Buffer.alloc(height * (stride + 1))
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
    }

    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0)
    ihdr.writeUInt32BE(height, 4)
    ihdr[8] = 8 // bit depth
    ihdr[9] = 6 // color type RGBA
    ihdr[10] = 0 // compression
    ihdr[11] = 0 // filter
    ihdr[12] = 0 // interlace

    return Buffer.concat([
        PNG_SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ])
}

/**
 * 크로마키 픽셀을 **완전 투명**으로 바꾼 RGBA PNG 를 만든다.
 *
 * 반환에 `keyed`(치환한 픽셀 수)를 함께 낸다 — 호출부가 "정말 지웠는지"를 로그로 확인하고,
 * 테스트가 **0이 아님**을 단언할 수 있어야 한다(조용히 아무것도 안 하는 변환을 막는다).
 */
export function removeChromaKey(buffer) {
    const { width, height, channels, data } = decode(buffer)
    const rgba = Buffer.alloc(width * height * 4)
    let keyed = 0

    for (let i = 0, o = 0; o < rgba.length; i += channels, o += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const isKey =
            r === CHROMA_KEY.r && g === CHROMA_KEY.g && b === CHROMA_KEY.b

        rgba[o] = r
        rgba[o + 1] = g
        rgba[o + 2] = b
        if (isKey) {
            /*
             * ★ 색도 0으로 지운다. 알파만 0으로 두면 브라우저가 확대·보간할 때
             *   투명 픽셀의 **파란 RGB 가 이웃으로 번져** 가장자리에 푸른 테가 생긴다
             *   (전형적인 알파 블리딩). 우리는 `pixelated` 라 보간이 없지만, 렌더러·
             *   확대 경로가 바뀌어도 안전하도록 값 자체를 없앤다.
             */
            rgba[o] = 0
            rgba[o + 1] = 0
            rgba[o + 2] = 0
            rgba[o + 3] = 0
            keyed++
        } else {
            rgba[o + 3] = channels === 4 ? data[i + 3] : 255
        }
    }

    return { png: encodeRGBA(width, height, rgba), keyed, width, height }
}
