package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.dto.DonationRequest;
import ch.schweizertafel.foodbridge.model.Donation;
import ch.schweizertafel.foodbridge.model.DonationStatus;
import ch.schweizertafel.foodbridge.model.Role;
import ch.schweizertafel.foodbridge.model.User;
import ch.schweizertafel.foodbridge.repository.DonationRepository;
import ch.schweizertafel.foodbridge.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class DonationService {

    private final DonationRepository donationRepository;
    private final UserRepository userRepository;

    public DonationService(DonationRepository donationRepository, UserRepository userRepository) {
        this.donationRepository = donationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Donation createDonation(DonationRequest request) {
        User donor = userRepository.findById(request.donorId())
                .orElseThrow(() -> new EntityNotFoundException("Donor " + request.donorId() + " not found"));
        if (donor.getRole() != Role.DONOR) {
            throw new IllegalArgumentException("Only users with role DONOR can register donations");
        }
        if (!request.overlapEnd().isAfter(request.overlapStart())) {
            throw new IllegalArgumentException("Pickup window end must be after its start");
        }
        Donation donation = new Donation(
                donor,
                request.productName().trim(),
                request.temperatureRange(),
                request.bestBeforeDate(),
                request.pickupAddress().trim(),
                request.numberOfPallets(),
                request.weightPerPallet(),
                request.overlapStart(),
                request.overlapEnd(),
                LocalDateTime.now());
        return donationRepository.save(donation);
    }

    /** All donations of a donor, newest first (active and already collected). */
    public List<Donation> getDonationsForDonor(Long donorId) {
        return donationRepository.findByDonorIdOrderByCreatedAtDesc(donorId);
    }

    /** AVAILABLE donations that still satisfy the 4-day freshness rule. */
    public List<Donation> getAvailableDonations() {
        LocalDateTime now = LocalDateTime.now();
        return donationRepository.findByStatusOrderByCreatedAtDesc(DonationStatus.AVAILABLE).stream()
                .filter(d -> FreshnessPolicy.isFresh(d, now))
                .toList();
    }

    public List<Donation> getAllDonations() {
        return donationRepository.findAll();
    }

    public Donation getDonation(Long id) {
        return donationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Donation " + id + " not found"));
    }
}
