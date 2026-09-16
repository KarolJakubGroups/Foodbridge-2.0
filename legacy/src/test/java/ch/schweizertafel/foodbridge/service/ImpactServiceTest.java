package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.dto.ImpactReport;
import ch.schweizertafel.foodbridge.model.Donation;
import ch.schweizertafel.foodbridge.model.Role;
import ch.schweizertafel.foodbridge.model.TemperatureRange;
import ch.schweizertafel.foodbridge.model.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ImpactServiceTest {

    @Test
    void impactIsDerivedFromPalletsTimesWeight() {
        User donor = new User("coop", "pw", Role.DONOR, "Coop", "Dietikon");
        LocalDateTime now = LocalDateTime.now();
        // TF-06: 2 pallets à 500 kg = 1000 kg
        Donation d = new Donation(donor, "Kartoffeln", TemperatureRange.AMBIENT, LocalDate.now().plusDays(10),
                "Dietikon", 2, 500.0, now, now.plusHours(4), now);

        ImpactReport report = ImpactService.calculate(List.of(d));

        assertThat(report.totalWeightKg()).isEqualTo(1000.0);
        assertThat(report.meals()).isEqualTo(2000);
        assertThat(report.co2SavedKg()).isEqualTo(1100.0);
        assertThat(report.donationCount()).isEqualTo(1);
    }

    @Test
    void emptyInputGivesZeroImpact() {
        ImpactReport report = ImpactService.calculate(List.of());
        assertThat(report.totalWeightKg()).isZero();
        assertThat(report.meals()).isZero();
        assertThat(report.co2SavedKg()).isZero();
    }
}
