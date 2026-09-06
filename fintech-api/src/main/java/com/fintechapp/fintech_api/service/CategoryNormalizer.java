package com.fintechapp.fintech_api.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.util.StringUtils;

/**
 * Single source of truth for canonical category normalization across the
 * fintech platform domain.
 *
 * <p>Enforces the domain invariant that category matching is case-insensitive
 * and whitespace-normalized everywhere. Any category entered via manual
 * budget creation, update, budget suggestions, transaction creation/update,
 * or Plaid ingestion is mapped to its unique canonical representation.</p>
 *
 * <p>Canonical representation rules:
 * <ul>
 *   <li>Leading and trailing whitespace is trimmed.</li>
 *   <li>Internal multiple spaces are collapsed to a single space.</li>
 *   <li>Hierarchical delimiters (colon, slash, pipe, backslash) are normalized to " / ".</li>
 *   <li>Words are title-cased (first letter uppercase, rest lowercase).</li>
 *   <li>Connectors ("and") normalize to "&amp;".</li>
 *   <li>Known genuine acronyms (US, UK, ATM, TV, etc.) remain uppercase.</li>
 * </ul>
 * </p>
 */
public final class CategoryNormalizer {

    private static final Set<String> KNOWN_ACRONYMS = Set.of(
            "US", "UK", "EU", "CA", "TV", "ID", "ATM", "DVD", "GPS", "VR",
            "PC", "HD", "AC", "PS4", "PS5", "IRA", "RRSP", "TFSA", "HOA", "HVAC");

    private CategoryNormalizer() {
    }

    /**
     * Normalizes a category string to its canonical domain representation.
     * Returns {@code null} if the input is null or whitespace-only.
     */
    public static String normalize(String rawCategory) {
        if (!StringUtils.hasText(rawCategory)) {
            return null;
        }

        String sanitized = rawCategory.trim();

        // Hierarchical separators ("Food and Drink:Dining Out" or "Travel/Air Travel")
        List<String> sections = new ArrayList<>();
        for (String section : sanitized.split("[:,/|\\\\]")) {
            String cleaned = titleCaseSection(section.trim());
            if (StringUtils.hasText(cleaned)) {
                sections.add(cleaned);
            }
        }

        if (sections.isEmpty()) {
            return null;
        }

        return String.join(" / ", sections);
    }

    private static String titleCaseSection(String raw) {
        if (!StringUtils.hasText(raw)) {
            return raw;
        }

        String normalized = raw.replaceAll("_AND_", " & ")
                .replaceAll("_N_", " & ")
                .replace("_", " ");

        List<String> tokens = new ArrayList<>();
        for (String piece : normalized.split("\\s+|(?<=[a-z])(?=[A-Z])")) {
            String trimmed = piece.trim();
            if (StringUtils.hasText(trimmed)) {
                tokens.add(trimmed);
            }
        }

        StringBuilder result = new StringBuilder();
        for (int i = 0; i < tokens.size(); i++) {
            String token = tokens.get(i);
            String tokenLower = token.toLowerCase(Locale.ROOT);

            if ("and".equalsIgnoreCase(token)) {
                result.append("&");
            } else if (isAcronym(token)) {
                result.append(token.toUpperCase(Locale.ROOT));
            } else {
                result.append(capitalize(tokenLower));
            }

            if (i < tokens.size() - 1) {
                result.append(' ');
            }
        }

        String joined = result.toString().trim();
        return collapseSpaces(joined);
    }

    private static boolean isAcronym(String token) {
        String stripped = token.replace("&", "").trim();
        return KNOWN_ACRONYMS.contains(stripped.toUpperCase(Locale.ROOT));
    }

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
