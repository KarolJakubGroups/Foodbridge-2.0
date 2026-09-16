package ch.schweizertafel.foodbridge.dto;

/** Aggregated impact figures: rescued weight, resulting meals and avoided CO2 emissions. */
public record ImpactReport(
        double totalWeightKg,
        long meals,
        double co2SavedKg,
        long donationCount
) {
}
