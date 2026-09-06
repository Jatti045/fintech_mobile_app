package com.fintechapp.fintech_api.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/**
 * Converts monetary amounts into the currency in which the application stores
 * aggregates. Rates intentionally follow the application's existing
 * current-rate model (rather than claiming historical-rate accuracy).
 */
@Service
public class CurrencyConversionService {

    private record CachedRate(double value, Instant expiresAt) { }

    private final RestClient restClient;
    private final Map<String, CachedRate> rates = new ConcurrentHashMap<>();
    private final Duration ttl;

    public CurrencyConversionService(
            @Qualifier("currencyRatesRestClient") RestClient restClient,
            @Value("${app.currency.rates-cache-seconds:3600}") long cacheSeconds) {
        this.restClient = restClient;
        this.ttl = Duration.ofSeconds(Math.max(1, cacheSeconds));
    }

    public double convert(double amount, String fromCurrency, String toCurrency) {
        String from = requireCurrency(fromCurrency);
        String to = requireCurrency(toCurrency);
        if (from.equals(to)) {
            return amount;
        }

        String key = from + ":" + to;
        CachedRate cached = rates.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return round2(amount * cached.value());
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.get()
                    .uri("/v4/latest/{currency}", from)
                    .retrieve()
                    .body(Map.class);
            Object rawRates = response == null ? null : response.get("rates");
            if (!(rawRates instanceof Map<?, ?> rateMap) || !(rateMap.get(to) instanceof Number rate)) {
                throw new IllegalStateException("target currency missing from rate response");
            }
            double value = rate.doubleValue();
            if (!Double.isFinite(value) || value <= 0) {
                throw new IllegalStateException("invalid exchange rate");
            }
            rates.put(key, new CachedRate(value, Instant.now().plus(ttl)));
            return round2(amount * value);
        } catch (Exception ex) {
            // Do not persist a raw amount under a different currency label. A
            // retryable failure is safer than silently corrupting aggregates.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Currency conversion is temporarily unavailable. Please retry.");
        }
    }

    private String requireCurrency(String value) {
        if (!StringUtils.hasText(value) || !value.trim().matches("(?i)[a-z]{3}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid currency code");
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private double round2(double value) {
        return Math.round(value * 100d) / 100d;
    }
}
