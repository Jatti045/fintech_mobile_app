package com.fintechapp.fintech_api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Server-owned exchange-rate client; rate API responses never reach clients. */
@Configuration
public class CurrencyConfig {

    @Bean("currencyRatesRestClient")
    RestClient currencyRatesRestClient(
            @Value("${app.currency.rates-base-url:https://api.exchangerate-api.com}") String baseUrl,
            @Value("${app.currency.rates-timeout-ms:5000}") int timeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int resolvedTimeout = Math.max(1_000, timeoutMs);
        factory.setConnectTimeout(resolvedTimeout);
        factory.setReadTimeout(resolvedTimeout);
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
}
