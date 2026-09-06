package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/**
 * Unit tests for the server-side currency conversion used to normalize
 * transaction amounts into the user's aggregation currency before any
 * financial aggregate is computed.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CurrencyConversionServiceTest {

    @Mock
    private RestClient restClient;

    @Mock
    private RestClient.RequestHeadersUriSpec<?> uriSpec;

    @Mock
    private RestClient.RequestHeadersSpec<?> headersSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    private CurrencyConversionService service;

    @BeforeEach
    void setUp() {
        service = new CurrencyConversionService(restClient, 3600);
    }

    private void stubRateResponse(Object body) {
        doReturn(uriSpec).when(restClient).get();
        doReturn(headersSpec).when(uriSpec).uri(anyString(), any(Object[].class));
        doReturn(responseSpec).when(headersSpec).retrieve();
        doReturn(body).when(responseSpec).body(Map.class);
    }

    @Test
    void convert_sameCurrency_returnsAmountWithoutCallingRateApi() {
        double result = service.convert(100.0, "usd", "USD");

        assertEquals(100.0, result);
        verifyNoInteractions(restClient);
    }

    @Test
    void convert_differentCurrency_appliesFetchedRate() {
        stubRateResponse(Map.of("rates", Map.of("CAD", 1.25)));

        double result = service.convert(100.0, "USD", "CAD");

        assertEquals(125.0, result);
        verify(restClient).get();
        verify(uriSpec).uri("/v4/latest/{currency}", "USD");
    }

    @Test
    void convert_repeatedConversionWithinTtl_usesCachedRate() {
        stubRateResponse(Map.of("rates", Map.of("CAD", 1.25)));

        double first = service.convert(100.0, "USD", "CAD");
        double second = service.convert(40.0, "USD", "CAD");

        assertEquals(125.0, first);
        assertEquals(50.0, second);
        // Only one HTTP round-trip: the second conversion reused the rate.
        verify(restClient, times(1)).get();
    }

    @Test
    void convert_invalidCurrencyCode_returnsBadRequest() {
        ResponseStatusException empty = assertThrows(
                ResponseStatusException.class, () -> service.convert(1.0, "", "CAD"));
        assertEquals(HttpStatus.BAD_REQUEST, empty.getStatusCode());

        ResponseStatusException tooShort = assertThrows(
                ResponseStatusException.class, () -> service.convert(1.0, "US", "CAD"));
        assertEquals(HttpStatus.BAD_REQUEST, tooShort.getStatusCode());

        ResponseStatusException tooLong = assertThrows(
                ResponseStatusException.class, () -> service.convert(1.0, "USDD", "CAD"));
        assertEquals(HttpStatus.BAD_REQUEST, tooLong.getStatusCode());
    }

    @Test
    void convert_targetCurrencyMissingFromRates_returnsServiceUnavailable() {
        stubRateResponse(Map.of("rates", Map.of("GBP", 0.5)));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class, () -> service.convert(100.0, "USD", "CAD"));

        // Fail closed: a raw amount must never be persisted under another
        // currency's label, so a missing rate is a hard error, not a fallback.
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
    }

    @Test
    void convert_rateApiFailure_returnsServiceUnavailable() {
        doThrow(new RuntimeException("connection refused")).when(restClient).get();

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class, () -> service.convert(100.0, "USD", "CAD"));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
    }
}
