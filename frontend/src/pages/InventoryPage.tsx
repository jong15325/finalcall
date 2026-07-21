import { TbLayoutGrid } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 인벤토리 — 빈 셸(FC-076에서 96칸 슬롯 구현, 확장은 자리만). */
export default function InventoryPage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbLayoutGrid}
            title="인벤토리"
            description="96칸 슬롯 그리드가 이 자리에 들어옵니다. (슬롯 확장은 준비 중)"
            ticket="FC-076에서 구현"
        />
    )
}
