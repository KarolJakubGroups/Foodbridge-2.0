package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.model.*;
import ch.schweizertafel.foodbridge.repository.DonationRepository;
import ch.schweizertafel.foodbridge.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ClaimServiceIntegrationTest {

    @Autowired ClaimService claimService;
    @Autowired DonationRepository donationRepository;
    @Autowired UserRepository userRepository;

    private Donation newDonation(LocalDateTime createdAt) {
        User donor = userRepository.findByUsername("migros").orElseThrow();
        LocalDateTime start = LocalDateTime.now().plusDays(1);
        Donation d = new Donation(donor, "Testware", TemperatureRange.AMBIENT, LocalDate.now().plusDays(7),
                donor.getAddress(), 1, 10.0, start, start.plusHours(4), createdAt);
        return donationRepository.save(d);
    }

    @Test
    void freshDonationCanBeClaimed() {
        User foodbank = userRepository.findByUsername("foodbank_zrh").orElseThrow();
        Donation d = newDonation(LocalDateTime.now().minusDays(3));

        Claim claim = claimService.claimDonation(d.getId(), foodbank.getId());

        assertThat(claim.getId()).isNotNull();
        assertThat(donationRepository.findById(d.getId()).orElseThrow().getStatus()).isEqualTo(DonationStatus.CLAIMED);
    }

    @Test
    void donationOlderThanFourDaysIsRejected() {
        User foodbank = userRepository.findByUsername("foodbank_zrh").orElseThrow();
        Donation d = newDonation(LocalDateTime.now().minusDays(5));

        assertThatThrownBy(() -> claimService.claimDonation(d.getId(), foodbank.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("older than 4 days");
        assertThat(donationRepository.findById(d.getId()).orElseThrow().getStatus()).isEqualTo(DonationStatus.AVAILABLE);
    }

    @Test
    void donationCannotBeClaimedTwice() {
        User foodbank = userRepository.findByUsername("foodbank_zrh").orElseThrow();
        Donation d = newDonation(LocalDateTime.now());
        claimService.claimDonation(d.getId(), foodbank.getId());

        assertThatThrownBy(() -> claimService.claimDonation(d.getId(), foodbank.getId()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void donorCannotClaim() {
        User donor = userRepository.findByUsername("coop").orElseThrow();
        Donation d = newDonation(LocalDateTime.now());

        assertThatThrownBy(() -> claimService.claimDonation(d.getId(), donor.getId()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
