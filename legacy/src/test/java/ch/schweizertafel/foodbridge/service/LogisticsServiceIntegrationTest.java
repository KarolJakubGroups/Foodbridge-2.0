package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.model.*;
import ch.schweizertafel.foodbridge.repository.DonationRepository;
import ch.schweizertafel.foodbridge.repository.TransportOrderRepository;
import ch.schweizertafel.foodbridge.repository.UserRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** End-to-end bundling on the seeded demo data (TF-04 / TF-05). */
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LogisticsServiceIntegrationTest {

    @Autowired LogisticsService logisticsService;
    @Autowired DonationRepository donationRepository;
    @Autowired TransportOrderRepository transportOrderRepository;
    @Autowired UserRepository userRepository;

    @Test
    @Order(1)
    void seededClaimedDonationsAreBundledPerDonorAndOverlap() {
        List<TransportOrder> created = logisticsService.generateTransportOrders();

        // migros: Äpfel+Birnen overlap -> 1 order, Orangen disjoint -> 1 order; coop: Bananen -> 1 order
        assertThat(created).hasSize(3);

        TransportOrder applesAndPears = created.stream()
                .filter(o -> o.getDonations().stream().anyMatch(d -> d.getProductName().startsWith("Äpfel")))
                .findFirst().orElseThrow();
        assertThat(applesAndPears.getDonations()).extracting(Donation::getProductName)
                .containsExactlyInAnyOrder("Äpfel Gala", "Birnen");
        assertThat(applesAndPears.getDonor().getUsername()).isEqualTo("migros");
        assertThat(applesAndPears.getPickupTime().toLocalTime()).isEqualTo(LocalTime.NOON);
        assertThat(applesAndPears.getPickupTime().toLocalDate()).isEqualTo(LocalDate.now().plusDays(3));

        assertThat(donationRepository.findByStatusAndTransportOrderIsNull(DonationStatus.CLAIMED)).isEmpty();
        assertThat(donationRepository.findByStatusIn(List.of(DonationStatus.BUNDLED))).hasSize(4);

        // second run must not create duplicates
        assertThat(logisticsService.generateTransportOrders()).isEmpty();
    }

    @Test
    @Order(2)
    void completingAnOrderCompletesItsDonations() {
        User donor = userRepository.findByUsername("coop").orElseThrow();
        LocalDateTime start = LocalDateTime.now().plusDays(6).withHour(8);
        Donation d = new Donation(donor, "Salat", TemperatureRange.CHILLED, LocalDate.now().plusDays(3),
                donor.getAddress(), 1, 15.0, start, start.plusHours(3), LocalDateTime.now());
        d.setStatus(DonationStatus.CLAIMED);
        d = donationRepository.save(d);

        TransportOrder order = logisticsService.generateTransportOrders().stream()
                .filter(o -> o.getDonations().stream().anyMatch(x -> x.getProductName().equals("Salat")))
                .findFirst().orElseThrow();

        logisticsService.updateStatus(order.getId(), TransportStatus.DISPATCHED);
        logisticsService.updateStatus(order.getId(), TransportStatus.COMPLETED);

        assertThat(transportOrderRepository.findById(order.getId()).orElseThrow().getStatus())
                .isEqualTo(TransportStatus.COMPLETED);
        assertThat(donationRepository.findById(d.getId()).orElseThrow().getStatus()).isEqualTo(DonationStatus.COMPLETED);
    }
}
