package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.model.Donation;
import ch.schweizertafel.foodbridge.model.Role;
import ch.schweizertafel.foodbridge.model.TemperatureRange;
import ch.schweizertafel.foodbridge.model.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure unit tests of the interval-scheduling bundling step (no Spring context). */
class LogisticsServiceTest {

    private static final User DONOR = new User("migros", "pw", Role.DONOR, "Migros", "Zürich");
    private static final LocalDateTime DAY = LocalDate.of(2026, 8, 10).atTime(8, 0);

    private static Donation donation(String name, int startHour, int endHour) {
        return new Donation(DONOR, name, TemperatureRange.AMBIENT, LocalDate.of(2026, 9, 1), "Zürich", 1, 100.0,
                DAY.withHour(startHour), DAY.withHour(endHour), DAY);
    }

    @Test
    void overlappingWindowsAreBundledIntoOneOrder() {
        Donation a = donation("Apples", 8, 12);
        Donation b = donation("Pears", 10, 14);

        List<List<Donation>> bundles = LogisticsService.partitionIntoBundles(List.of(b, a));

        assertThat(bundles).hasSize(1);
        assertThat(bundles.get(0)).containsExactly(a, b);
    }

    @Test
    void disjointWindowsProduceSeparateOrders() {
        Donation morning = donation("Bread", 8, 10);
        Donation afternoon = donation("Milk", 14, 16);

        List<List<Donation>> bundles = LogisticsService.partitionIntoBundles(List.of(afternoon, morning));

        assertThat(bundles).hasSize(2);
        assertThat(bundles.get(0)).containsExactly(morning);
        assertThat(bundles.get(1)).containsExactly(afternoon);
    }

    @Test
    void touchingWindowsCountAsOverlap() {
        // start exactly at the reference end -> "<=" comparison keeps them together
        Donation a = donation("A", 8, 10);
        Donation b = donation("B", 10, 12);

        assertThat(LogisticsService.partitionIntoBundles(List.of(a, b))).hasSize(1);
    }

    @Test
    void chainedOverlapsWithoutCommonPointAreSplit() {
        // A 8-10, B 9-13, C 11-14: B overlaps both, but A and C never overlap.
        Donation a = donation("A", 8, 10);
        Donation b = donation("B", 9, 13);
        Donation c = donation("C", 11, 14);

        List<List<Donation>> bundles = LogisticsService.partitionIntoBundles(List.of(c, b, a));

        assertThat(bundles).hasSize(2);
        assertThat(bundles.get(0)).containsExactly(a, b);
        assertThat(bundles.get(1)).containsExactly(c);
    }

    @Test
    void firstElementOfEachBundleDefinesTheReferenceEnd() {
        Donation late = donation("Late", 9, 18);
        Donation early = donation("Early", 8, 11);

        List<List<Donation>> bundles = LogisticsService.partitionIntoBundles(List.of(late, early));

        assertThat(bundles.get(0).get(0)).isSameAs(early);
        assertThat(bundles.get(0).get(0).getOverlapEnd()).isEqualTo(DAY.withHour(11));
    }

    @Test
    void emptyInputYieldsNoBundles() {
        assertThat(LogisticsService.partitionIntoBundles(List.of())).isEmpty();
    }

    @Test
    void hundredDonationsAreBundledWellBelowPerformanceBudget() {
        List<Donation> many = new java.util.ArrayList<>();
        for (int i = 0; i < 120; i++) {
            many.add(donation("D" + i, (i % 12), (i % 12) + 3));
        }
        long start = System.nanoTime();
        List<List<Donation>> bundles = LogisticsService.partitionIntoBundles(many);
        long millis = (System.nanoTime() - start) / 1_000_000;

        assertThat(bundles).isNotEmpty();
        assertThat(millis).isLessThan(200);
    }
}
