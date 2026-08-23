import { useState } from 'react'
import CharacterProfileSelector from '@/features/member/components/CharacterProfileSelector'
import ProfileAvatar from '@/features/member/components/ProfileAvatar'
import type { CharacterProfileOption } from '../fixtures/characterProfile'

export default function CharacterProfileCandidate({
    characters,
}: {
    characters: readonly CharacterProfileOption[]
}) {
    const [selectedId, setSelectedId] = useState(characters[0]?.id ?? 1)
    return (
        <section
            data-character-profile-workbench
            className="rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6"
        >
            <div className="flex items-center gap-4">
                <ProfileAvatar
                    primaryCharacterId={selectedId}
                    name="캐릭터 수집가"
                    className="size-[5.5rem] rounded-2xl border border-content-line md:size-24"
                />
                <div>
                    <h1 className="text-xl font-bold text-content-fg">
                        기본 캐릭터
                    </h1>
                    <p className="mt-1 text-sm text-content-muted">
                        프로필 이미지를 눌러 변경하는 운영 선택판입니다.
                    </p>
                </div>
            </div>
            <div className="mt-5 border-t border-content-line pt-5">
                <CharacterProfileSelector
                    value={selectedId}
                    onChange={setSelectedId}
                />
            </div>
        </section>
    )
}
