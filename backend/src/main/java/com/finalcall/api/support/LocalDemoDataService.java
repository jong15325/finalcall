package com.finalcall.api.support;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemOwnershipHistory;
import com.finalcall.domain.item.ItemOwnershipHistoryRepository;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.item.SkillDefinition;
import com.finalcall.domain.item.SkillDefinitionRepository;
import com.finalcall.domain.item.TempStorage;
import com.finalcall.domain.item.TempStorageRepository;
import com.finalcall.domain.item.TransferType;
import com.finalcall.domain.member.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 로컬 데모 시드(FC-084)의 <b>트랜잭션 경계 헬퍼</b> — 도메인 서비스가 다루지 않는 데이터(아이템 인스턴스 신규
 * 발행·임시보관·초기 잔액)를 도메인 엔티티/리포지토리로 삽입한다. {@link LocalDemoSeeder}(비-트랜잭션 러너)가
 * 외부 빈으로 호출해 각 메서드가 프록시 경유 독립 트랜잭션을 갖는다(AOP self-invocation 회피). local 전용이다.
 *
 * <p>아이템 발행은 운영 경로에 존재하지 않아(카탈로그 시드 외 신규 발행 서비스가 없음) 여기서 엔티티 빌더 +
 * 소유이력(SEED) append 로 직접 만든다. 잔액 funding 은 절대값 세팅이라 원장 흐름이 없어 {@link JdbcTemplate}
 * 로 처리한다(홀드 0 상태에서 세팅되므로 이후 입찰 홀드·낙찰 차감과 정합).
 */
@Component
@Profile("local")
@RequiredArgsConstructor
public class LocalDemoDataService {

    private final ItemInstanceRepository itemInstanceRepository;
    private final ItemOwnershipHistoryRepository itemOwnershipHistoryRepository;
    private final ItemTemplateRepository itemTemplateRepository;
    private final SkillDefinitionRepository skillDefinitionRepository;
    private final TempStorageRepository tempStorageRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    /** skill_code → id 캐시(마스터 5건, 최초 1회 로드). 절대 식별자만 담아 트랜잭션 경계를 넘어 재사용해도 안전하다. */
    private Map<Integer, Long> skillIdByCode;

    /**
     * 초기 잔액을 절대값으로 세팅한다(캐시·게임머니). 가입 직후 홀드 0 상태에서 호출되므로 이후 입찰 홀드·낙찰
     * 차감이 그대로 정합한다(잔액 ≥ 홀드 불변식 유지).
     */
    @Transactional
    public void fund(Long userId, long cash, long gameMoney) {
        jdbcTemplate.update(
            "UPDATE user_balance SET cash_balance = ?, game_money_balance = ? WHERE user_id = ?",
            cash, gameMoney, userId);
    }

    /**
     * 정규 인벤토리 아이템을 발행한다(소유이력 SEED append 포함). 슬롯 유일성은 호출 측이 소유자별 증가 커서로
     * 보장하며 최종 방어선은 DB {@code slot_key} UK 다.
     *
     * @return 발행된 인스턴스의 public_id(경매 등록 입력으로 쓰인다)
     */
    @Transactional
    public String createInventoryItem(Long ownerId, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt, int slotNo) {
        return create(ownerId, typeCode, level, skill1Code, skill2Code, skillPercent, gfExpireAt,
            ItemLocation.INVENTORY, slotNo, null);
    }

    /**
     * 임시보관 아이템을 발행한다(location=TEMP + temp_storage 행 1:1, 소유이력 SEED append). relocate 데모용이며
     * {@code expireAt} 으로 만료 임박분도 심는다.
     */
    @Transactional
    public void createTempItem(Long ownerId, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt, Instant expireAt) {
        create(ownerId, typeCode, level, skill1Code, skill2Code, skillPercent, gfExpireAt,
            ItemLocation.TEMP, null, expireAt);
    }

    private String create(Long ownerId, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt, ItemLocation location, Integer slotNo, Instant tempExpireAt) {
        ItemTemplate template = itemTemplateRepository.findByTypeCode(typeCode)
            .orElseThrow(() -> new IllegalStateException("데모 시드 템플릿 없음 typeCode=" + typeCode));
        ItemInstance item = itemInstanceRepository.save(ItemInstance.builder()
            .template(template)
            .owner(userRepository.getReferenceById(ownerId))
            .level(level)
            .skill1(skillReference(skill1Code))
            .skill2(skillReference(skill2Code))
            .skillPercent(skillPercent)
            .gfExpireAt(gfExpireAt)
            .location(location)
            .slotNo(slotNo)
            .build());
        itemOwnershipHistoryRepository.save(ItemOwnershipHistory.builder()
            .instanceId(item.getId())
            .fromOwnerId(null)
            .toOwnerId(ownerId)
            .transferType(TransferType.SEED)
            .saleOrderId(null)
            .transferredAt(item.getCreatedAt())
            .build());
        if (location == ItemLocation.TEMP) {
            tempStorageRepository.save(TempStorage.builder()
                .instance(item)
                .ownerId(ownerId)
                .storedAt(item.getCreatedAt())
                .expireAt(tempExpireAt)
                .build());
        }
        return item.getPublicId();
    }

    private SkillDefinition skillReference(Integer skillCode) {
        if (skillCode == null) {
            return null;
        }
        return skillDefinitionRepository.getReferenceById(skillId(skillCode));
    }

    private Long skillId(int skillCode) {
        if (skillIdByCode == null) {
            Map<Integer, Long> loaded = new HashMap<>();
            skillDefinitionRepository.findAll().forEach(skill -> loaded.put(skill.getSkillCode(), skill.getId()));
            skillIdByCode = loaded;
        }
        Long id = skillIdByCode.get(skillCode);
        if (id == null) {
            throw new IllegalStateException("데모 시드 스킬 없음 skillCode=" + skillCode);
        }
        return id;
    }
}
