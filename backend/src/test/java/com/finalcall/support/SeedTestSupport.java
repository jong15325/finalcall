package com.finalcall.support;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.TempStorageRepository;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;

/**
 * 시드(V9__item_seed.sql) 보존 테스트 정리 유틸.
 *
 * <p>V9 시드가 생성한 seed user(및 그 잔액)는 item_instance·item_ownership_history 가 FK 로 참조하므로,
 * 비-트랜잭션 통합 테스트의 전체 truncate({@code userRepository.deleteAllInBatch()})가 FK 위반으로 깨진다.
 * 또한 seed user 를 지우면 그에 딸린 시드 아이템도 함께 정리해야 해 시드 검증 테스트가 순서에 따라 실패한다.
 * 따라서 이 유틸은 <b>시드 user 를 보존</b>하고 테스트가 만든 user·잔액만 정리한다(시드 아이템 무접촉).
 */
public final class SeedTestSupport {

    /** V9 시드가 생성하는 seed user 의 login_id. 시드 SQL 과 동일해야 한다(단일 진실원 주석). */
    public static final Set<String> SEED_LOGIN_IDS = Set.of("seed_seller", "seed_buyer");

    private SeedTestSupport() {
    }

    /**
     * 시드 user 를 제외한 테스트 생성 user·잔액을 정리한다(FK 순서: 잔액 → user). 시드 아이템 행은 건드리지 않는다.
     */
    public static void deleteNonSeedUsers(
        UserRepository userRepository, UserBalanceRepository userBalanceRepository) {
        List<User> testUsers = userRepository.findAll().stream()
            .filter(user -> !SEED_LOGIN_IDS.contains(user.getLoginId()))
            .toList();
        List<UserBalance> testBalances = testUsers.stream()
            .map(user -> userBalanceRepository.findByUserId(user.getId()))
            .flatMap(Optional::stream)
            .toList();
        userBalanceRepository.deleteAllInBatch(testBalances);
        userRepository.deleteAllInBatch(testUsers);
    }

    /**
     * 비-트랜잭션 아이템 통합 테스트 정리: 시드가 아닌 아이템 데이터(temp_storage 전부 + 비-시드 소유 instance)와
     * 비-시드 user 를 FK 순서로 지운다. 시드 instance(seed user 소유)·시드 user·템플릿·스킬 마스터는 보존한다.
     *
     * <p>temp_storage 는 시드가 만들지 않아 전량 삭제해도 안전하다. instance 는 owner 프록시 id(초기화 불필요)로
     * 시드 소유자 여부를 판정해 비-시드 소유분만 삭제한다(본 테스트들은 소유이력 행을 만들지 않으므로 선삭제 불요).
     */
    public static void deleteNonSeedItemData(
        ItemInstanceRepository itemInstanceRepository,
        TempStorageRepository tempStorageRepository,
        UserRepository userRepository,
        UserBalanceRepository userBalanceRepository) {
        tempStorageRepository.deleteAllInBatch();

        Set<Long> seedUserIds = userRepository.findAll().stream()
            .filter(user -> SEED_LOGIN_IDS.contains(user.getLoginId()))
            .map(User::getId)
            .collect(Collectors.toSet());
        List<ItemInstance> testInstances = itemInstanceRepository.findAll().stream()
            .filter(instance -> !seedUserIds.contains(instance.getOwner().getId()))
            .toList();
        itemInstanceRepository.deleteAllInBatch(testInstances);

        deleteNonSeedUsers(userRepository, userBalanceRepository);
    }
}
