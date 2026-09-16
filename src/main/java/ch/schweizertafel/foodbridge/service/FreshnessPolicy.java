package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.model.Donation;

import java.time.LocalDateTime;

/**
 * Freshness rule of Schweizer Tafel: a donation older than 4 days (96 hours,
 * measured from createdAt) must neither be shown to nor claimed by a foodbank.
 */
public final class FreshnessPolicy {

    public static final int MAX_AGE_DAYS = 4;

    private FreshnessPolicy() {
    }

    public static LocalDateTime cutoff(LocalDateTime now) {
        return now.minusDays(MAX_AGE_DAYS);
    }

    public static boolean isFresh(Donation donation, LocalDateTime now) {
        return donation.getCreatedAt().isAfter(cutoff(now));
    }
}
