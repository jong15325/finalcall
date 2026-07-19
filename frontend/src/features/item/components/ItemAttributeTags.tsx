import Tag from '@/components/ui/Tag'
import classNames from '@/utils/classNames'
import { elementBadgeLabelOf } from '../lib/element'
import { itemTypeLabel } from '../lib/itemCode'

/**
 * 아이템 속성 표시 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **색 구분이 사라진 자리를 글자가 대신한다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전 설계는 속성을 **element 4색 배지**로 표시했다. 방침상 그 색을 쓸 수 없고 템플릿 `Tag` 는
 * 기본색이 하나뿐이라, 물·불·흙·바람 배지가 **서로 완전히 같은 회색 알약**이 된다.
 * → **판별 채널이 글자밖에 없다.** 접근성(WCAG 1.4.1) 준수를 넘어 **기능이 성립하려면**
 *   속성이 글자로 읽혀야 한다.
 *
 * 그래서 두 가지를 한다:
 * 1. **축 이름을 병기한다** — "물"이 아니라 **"물 속성"**. 색이 있을 때는 배지 색이 "이건
 *    속성 축이다"를 말해줬지만, 지금은 같은 회색 알약 셋이 나란히 서 있어 **읽어도 어느 것이
 *    속성이고 어느 것이 종류인지 알 수 없다**(게임을 모르면 "물"이 종류일 수도 있다).
 * 2. **순서를 고정한다** — 속성 → 종류 → 레벨. 색이 없으면 위치가 유일한 부차 단서다.
 *
 * ★ `Tag` 에 `className` 으로 색을 주지 마라. 그 순간 방침이 무너지고, 되살아난 4색은
 *   다음 사람이 "원래 그랬나 보다" 하고 확산시킨다.
 */

interface ItemAttributeTagsProps {
    subGroup: number
    element: number
    kind: number
    level: number
    className?: string
}

const ItemAttributeTags = ({
    subGroup,
    element,
    kind,
    level,
    className,
}: ItemAttributeTagsProps) => {
    return (
        <ul
            className={classNames(
                'flex flex-wrap items-center gap-1',
                className,
            )}
            data-testid="item-attribute-tags"
        >
            <li>
                {/* ★ "물"이 아니라 "물 속성" — 위 ★★ 참조. 색으로 축을 알릴 수 없다. */}
                <Tag>{elementBadgeLabelOf(element)}</Tag>
            </li>
            <li>
                <Tag>{itemTypeLabel(subGroup, kind)}</Tag>
            </li>
            <li>
                <Tag>
                    <span className="tabular-nums">Lv.{level}</span>
                </Tag>
            </li>
        </ul>
    )
}

export default ItemAttributeTags
