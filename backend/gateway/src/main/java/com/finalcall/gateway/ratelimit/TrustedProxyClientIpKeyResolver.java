package com.finalcall.gateway.ratelimit;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.http.HttpHeaders;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;

import com.finalcall.gateway.config.GatewayClientIpProperties;

import reactor.core.publisher.Mono;

/** 고정된 신뢰 프록시 수를 기준으로 우측부터 client IP를 선택하는 rate limit key resolver. */
public class TrustedProxyClientIpKeyResolver implements KeyResolver {

    private static final String UNKNOWN_KEY = "unknown";
    private static final String FORWARDED = "Forwarded";
    private static final String X_FORWARDED_FOR = "X-Forwarded-For";

    private final int trustedProxyCount;

    public TrustedProxyClientIpKeyResolver(GatewayClientIpProperties properties) {
        this.trustedProxyCount = properties.trustedProxyCount();
    }

    @Override
    public Mono<String> resolve(ServerWebExchange exchange) {
        String remoteAddress = remoteAddress(exchange);
        if (trustedProxyCount == 0) {
            return Mono.just(remoteAddress);
        }

        String forwardedAddress = forwardedAddress(exchange.getRequest().getHeaders());
        String xffAddress = xffAddress(exchange.getRequest().getHeaders());
        if (forwardedAddress != null && xffAddress != null
            && !forwardedAddress.equals(xffAddress)) {
            return Mono.just(remoteAddress);
        }
        if (forwardedAddress != null) {
            return Mono.just(forwardedAddress);
        }
        if (xffAddress != null) {
            return Mono.just(xffAddress);
        }
        return Mono.just(remoteAddress);
    }

    private String remoteAddress(ServerWebExchange exchange) {
        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        if (remoteAddress == null) {
            return UNKNOWN_KEY;
        }
        if (remoteAddress.getAddress() != null) {
            return remoteAddress.getAddress().getHostAddress();
        }
        String normalized = normalizeIpLiteral(remoteAddress.getHostString());
        return normalized == null ? UNKNOWN_KEY : normalized;
    }

    private String forwardedAddress(HttpHeaders headers) {
        List<String> addresses = new ArrayList<>();
        for (String header : headers.getOrEmpty(FORWARDED)) {
            for (String element : header.split(",")) {
                String address = forwardedForParameter(element);
                if (address == null) {
                    return null;
                }
                addresses.add(address);
            }
        }
        return trustedClientAddress(addresses);
    }

    private String forwardedForParameter(String element) {
        for (String parameter : element.split(";")) {
            int separator = parameter.indexOf('=');
            if (separator <= 0 || !"for".equals(parameter.substring(0, separator).trim()
                .toLowerCase(Locale.ROOT))) {
                continue;
            }
            return normalizeAddressToken(parameter.substring(separator + 1));
        }
        return null;
    }

    private String xffAddress(HttpHeaders headers) {
        List<String> addresses = new ArrayList<>();
        for (String header : headers.getOrEmpty(X_FORWARDED_FOR)) {
            for (String element : header.split(",")) {
                String address = normalizeAddressToken(element);
                if (address == null) {
                    return null;
                }
                addresses.add(address);
            }
        }
        return trustedClientAddress(addresses);
    }

    private String trustedClientAddress(List<String> addresses) {
        int candidateIndex = addresses.size() - trustedProxyCount;
        if (candidateIndex < 0 || candidateIndex >= addresses.size()) {
            return null;
        }
        return addresses.get(candidateIndex);
    }

    private String normalizeAddressToken(String token) {
        String candidate = token.trim();
        if (candidate.length() >= 2 && candidate.startsWith("\"") && candidate.endsWith("\"")) {
            candidate = candidate.substring(1, candidate.length() - 1);
        }
        if (!StringUtils.hasText(candidate) || "unknown".equalsIgnoreCase(candidate)
            || candidate.startsWith("_")) {
            return null;
        }
        if (candidate.startsWith("[")) {
            int bracket = candidate.indexOf(']');
            if (bracket < 0 || !validPortSuffix(candidate.substring(bracket + 1))) {
                return null;
            }
            candidate = candidate.substring(1, bracket);
        } else if (candidate.indexOf(':') == candidate.lastIndexOf(':') && candidate.contains(".")) {
            int portSeparator = candidate.lastIndexOf(':');
            if (portSeparator > 0) {
                if (!validPortSuffix(candidate.substring(portSeparator))) {
                    return null;
                }
                candidate = candidate.substring(0, portSeparator);
            }
        }
        return normalizeIpLiteral(candidate);
    }

    private boolean validPortSuffix(String suffix) {
        if (suffix.isEmpty()) {
            return true;
        }
        if (!suffix.startsWith(":")) {
            return false;
        }
        try {
            int port = Integer.parseInt(suffix.substring(1));
            return port >= 0 && port <= 65_535;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private String normalizeIpLiteral(String candidate) {
        if (!StringUtils.hasText(candidate) || !isIpLiteral(candidate)) {
            return null;
        }
        try {
            return InetAddress.getByName(candidate).getHostAddress();
        } catch (UnknownHostException ex) {
            return null;
        }
    }

    private boolean isIpLiteral(String candidate) {
        if (candidate.contains(":")) {
            return candidate.matches("[0-9a-fA-F:.]+");
        }
        String[] octets = candidate.split("\\.", -1);
        if (octets.length != 4) {
            return false;
        }
        for (String octet : octets) {
            if (!octet.matches("[0-9]{1,3}") || Integer.parseInt(octet) > 255) {
                return false;
            }
        }
        return true;
    }
}
