package com.fintechapp.fintech_api.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Sanitizes raw Plaid personal-finance category values into clean,
 * user-facing names.
 *
 * <p>
 * Plaid returns either legacy coarse codes such as {@code FOOD_AND_DRINK}
 * or hierarchical values like {@code Travel:Air Travel}. Both are normalised
 * to readable Title Case, e.g. {@code FOOD_AND_DRINK} &rarr;
 * {@code Food &amp; Drink}
 * and {@code TRAVEL:Air Travel} &rarr; {@code Travel / Air Travel}. The result
 * is what gets persisted on {@code transactions.category} and used as the
 * per-month budget category key.
 * </p>
 */
@Component
public class PlaidCategoryFormatter {

    public String toReadableCategory(String rawCategory) {
        String normalized = CategoryNormalizer.normalize(rawCategory);
        return normalized != null ? normalized : "Other";
    }

    private String titleCase(String raw) {
        if (!StringUtils.hasText(raw)) {
            return raw;
        }

        String text = raw;
        StringBuilder result = new StringBuilder();

        // A single enum-style token ("FOOD_AND_DRINK") → split into words.
        List<String> tokens = splitTokens(text);
        for (int i = 0; i < tokens.size(); i++) {
            String tokenLower = tokens.get(i);
            String token = tokenLower;

            // Preserve connectors that unify natural-language groups.
            if ("and".equalsIgnoreCase(token)) {
                token = "&";
            } else if (isAcronym(token)) {
                token = token.toUpperCase(Locale.ROOT);
            } else {
                token = capitalize(tokenLower);
            }

            result.append(token);
            if (i < tokens.size() - 1) {
                result.append(' ');
            }
        }

        String joined = result.toString().trim();
        if (!StringUtils.hasText(joined)) {
            return raw;
        }

        return collapseSpaces(joined);
    }

    private static List<String> splitTokens(String text) {
        List<String> tokens = new ArrayList<>();
        String normalized = text.replaceAll("_AND_", " & ")
                .replaceAll("_N_", " & ")
                .replace("_", " ");
        for (String piece : normalized.split("\\s+|(?<=[a-z])(?=[A-Z])")) {
            String trimmed = piece.trim();
            if (StringUtils.hasText(trimmed)) {
                tokens.add(trimmed);
            }
        }
        return tokens;
    }

    private static boolean isAcronym(String token) {
        String stripped = token.replace("&", "").trim();
        return KNOWN_ACRONYMS.contains(stripped.toUpperCase(Locale.ROOT));
    }

    /**
     * Genuine acronyms to keep uppercase; category words like FOOD/RENT/PETS
     * are title-cased instead.
     */
    private static final Set<String> KNOWN_ACRONYMS = Set.of(
            "US", "UK", "EU", "CA", "TV", "ID", "ATM", "DVD", "GPS", "VR",
            "PC", "HD", "AC", "PS4", "PS5", "IRA", "RRSP", "TFSA", "HOA", "HVAC");

    private static String capitalize(String word) {
        if (word.isEmpty()) {
            return word;
        }
        return Character.toUpperCase(word.charAt(0)) + word.substring(1).toLowerCase(Locale.ROOT);
    }

    private static String collapseSpaces(String value) {
        return value.replaceAll("\\s+", " ").trim().replaceAll("\\s+&\\s+", " & ");
    }
}
