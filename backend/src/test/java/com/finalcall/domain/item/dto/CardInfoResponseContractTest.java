package com.finalcall.domain.item.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.RecordComponent;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auction.dto.AuctionItemResponse;
import com.finalcall.domain.delivery.dto.DeliveryDetailResponse;
import com.finalcall.domain.delivery.dto.DeliverySummaryResponse;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.service.CardInfoFactory;
import com.finalcall.domain.shop.dto.ShopItemResponse;

class CardInfoResponseContractTest {

    private static final Instant AS_OF = Instant.parse("2026-08-23T00:00:00Z");

    private final CardInfoFactory factory = new CardInfoFactory(Clock.fixed(AS_OF, ZoneOffset.UTC));

    @Test
    void 모든_카드_응답군이_동일한_cardInfo_타입을_사용한다() {
        assertCardInfoComponent(AuctionItemResponse.class);
        assertCardInfoComponent(ShopItemResponse.class);
        assertCardInfoComponent(ItemSummaryResponse.class);
        assertCardInfoComponent(ItemInstanceDetailResponse.class);

        assertThat(componentType(DeliverySummaryResponse.class, "item")).isEqualTo(ItemSummaryResponse.class);
        assertThat(componentType(DeliveryDetailResponse.class, "item")).isEqualTo(ItemSummaryResponse.class);
        assertThat(componentType(InventoryResponse.InventoryItem.class, "summary"))
            .isEqualTo(ItemSummaryResponse.class);
        assertThat(componentType(TempStorageItemResponse.class, "summary"))
            .isEqualTo(ItemSummaryResponse.class);
    }

    @Test
    void 인벤토리_목록의_cardInfo는_하나의_기준시각을_공유한다() {
        ItemInstance first = item("ITEM000000000000000000001", 0, 4);
        ItemInstance second = item("ITEM000000000000000000002", 1, 9);

        InventoryResponse response = InventoryResponse.from(
            new InventoryData(96, List.of(first, second)), item -> factory.create(item, AS_OF));

        assertThat(response.items())
            .extracting(entry -> entry.summary().cardInfo().calculatedAt())
            .containsOnly(AS_OF);
    }

    private void assertCardInfoComponent(Class<?> responseType) {
        assertThat(componentType(responseType, "cardInfo")).isEqualTo(CardInfoResponse.class);
    }

    private Class<?> componentType(Class<?> responseType, String name) {
        return Arrays.stream(responseType.getRecordComponents())
            .filter(component -> component.getName().equals(name))
            .map(RecordComponent::getType)
            .findFirst()
            .orElseThrow();
    }

    private ItemInstance item(String publicId, int slotNo, int level) {
        ItemTemplate template = ItemTemplate.builder()
            .mainCategory(1)
            .subGroup(1)
            .element(4)
            .kind(3)
            .typeCode(1_143)
            .displayName("바람의 검")
            .build();
        return ItemInstance.builder()
            .publicId(publicId)
            .template(template)
            .level(level)
            .skillPercent(0)
            .location(ItemLocation.INVENTORY)
            .slotNo(slotNo)
            .build();
    }
}
