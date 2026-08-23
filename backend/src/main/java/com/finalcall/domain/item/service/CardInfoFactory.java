package com.finalcall.domain.item.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Component;

import com.finalcall.domain.item.dto.CardInfoResponse;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.entity.SkillDefinition;

@Component
public class CardInfoFactory {

    private static final int MAX_GOLDFORCE_DAYS = 999;

    private final Clock clock;

    public CardInfoFactory(Clock clock) {
        this.clock = clock;
    }

    public Instant now() {
        return clock.instant();
    }

    public CardInfoResponse create(ItemInstance item, Instant calculatedAt) {
        ItemTemplate template = item.getTemplate();
        CardInfoResponse.Category category = category(template.getSubGroup());
        CardInfoResponse.Kind kind = kind(template.getSubGroup(), template.getKind());
        CardInfoResponse.Element element = element(template.getElement());
        CardInfoResponse.Frame frame = frame(item.getGfExpireAt(), calculatedAt);
        return CardInfoResponse.builder()
            .level(item.getLevel())
            .shortName("Lv." + item.getLevel() + " " + element.abbreviation() + kind.abbreviation())
            .formalName(item.getLevel() + "레벨 " + kind.label())
            .category(category)
            .kind(kind)
            .element(element)
            .channelLimit(channelLimit(item.getLevel()))
            .frame(frame)
            .skills(List.of(skill(1, item.getSkill1(), null), skill(2, item.getSkill2(), item.getSkillPercent())))
            .calculatedAt(calculatedAt)
            .validUntil(validUntil(item.getGfExpireAt(), calculatedAt, frame.remainingGoldforceDays()))
            .build();
    }

    private CardInfoResponse.Category category(int subGroup) {
        String label = switch (subGroup) {
            case 1 -> "무기";
            case 2 -> "방어구";
            case 3 -> "마법";
            default -> "분류 " + subGroup;
        };
        return new CardInfoResponse.Category(subGroup, label);
    }

    private CardInfoResponse.Kind kind(int subGroup, int kind) {
        String label;
        String abbreviation;
        if (subGroup == 1) {
            label = switch (kind) {
                case 1 -> "도끼";
                case 2 -> "지팡이";
                case 3 -> "칼";
                case 4 -> "활";
                default -> "종류 " + kind;
            };
            abbreviation = switch (kind) {
                case 1 -> "도";
                case 2 -> "지";
                case 3 -> "검";
                case 4 -> "활";
                default -> String.valueOf(kind);
            };
        } else if (subGroup == 2) {
            label = switch (kind) {
                case 1 -> "방패";
                case 2 -> "펜던트";
                case 3 -> "갑옷";
                case 4 -> "신발";
                default -> "종류 " + kind;
            };
            abbreviation = switch (kind) {
                case 1 -> "방";
                case 2 -> "펜";
                case 3 -> "갑";
                case 4 -> "신";
                default -> String.valueOf(kind);
            };
        } else if (subGroup == 3) {
            label = kind == 1 ? "마법" : kind == 2 ? "스페셜필" : "종류 " + kind;
            abbreviation = kind == 1 ? "필" : kind == 2 ? "스필" : String.valueOf(kind);
        } else {
            label = "종류 " + kind;
            abbreviation = String.valueOf(kind);
        }
        return new CardInfoResponse.Kind(kind, label, abbreviation);
    }

    private CardInfoResponse.Element element(int code) {
        String label = switch (code) {
            case 1 -> "물";
            case 2 -> "불";
            case 3 -> "흙";
            case 4 -> "바람";
            default -> "속성 " + code;
        };
        return new CardInfoResponse.Element(code, label, code == 4 ? "바" : label);
    }

    private CardInfoResponse.ChannelLimit channelLimit(int level) {
        if (level <= 4) {
            return new CardInfoResponse.ChannelLimit("BEGINNER", "초보채널 이상");
        }
        if (level <= 6) {
            return new CardInfoResponse.ChannelLimit("INTERMEDIATE", "중수채널 이상");
        }
        return new CardInfoResponse.ChannelLimit("EXPERT", "고수채널 이상");
    }

    private CardInfoResponse.Frame frame(Instant expireAt, Instant calculatedAt) {
        if (expireAt == null || !expireAt.isAfter(calculatedAt)) {
            return new CardInfoResponse.Frame("BLACK", "블랙", 0);
        }
        Duration remaining = Duration.between(calculatedAt, expireAt);
        long wholeDays = remaining.toDays();
        long roundedUpDays = remaining.minusDays(wholeDays).isZero() ? wholeDays : wholeDays + 1;
        int days = (int)Math.min(MAX_GOLDFORCE_DAYS, roundedUpDays);
        return new CardInfoResponse.Frame("GOLD", "골드", days);
    }

    private Instant validUntil(Instant expireAt, Instant calculatedAt, int remainingDays) {
        if (expireAt == null || !expireAt.isAfter(calculatedAt)) {
            return null;
        }
        return expireAt.minus(Math.max(0, remainingDays - 1L), ChronoUnit.DAYS);
    }

    private CardInfoResponse.Skill skill(int slot, SkillDefinition skill, Integer percent) {
        if (skill == null) {
            return new CardInfoResponse.Skill(slot, null, null, null);
        }
        Integer displayedPercent = slot == 2 && percent != null && percent > 0 ? percent : null;
        return new CardInfoResponse.Skill(slot, skill.getSkillCode(), skill.getName(), displayedPercent);
    }
}
