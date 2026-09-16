package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.model.*;
import ch.schweizertafel.foodbridge.repository.ClaimRepository;
import ch.schweizertafel.foodbridge.repository.DonationRepository;
import ch.schweizertafel.foodbridge.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ClaimService {

    private final ClaimRepository claimRepository;
    private final DonationRepository donationRepository;
    private final UserRepository userRepository;

    public ClaimService(ClaimRepository claimRepository, DonationRepository donationRepository,
                        UserRepository userRepository) {
        this.claimRepository = claimRepository;
        this.donationRepository = donationRepository;
        this.userRepository = userRepository;
    }

    /**
     * A foodbank claims a donation bindingly. The 4-day freshness rule is enforced
     * server-side here as well, independent of the UI filter.
     */
    @Transactional
    public Claim claimDonation(Long donationId, Long foodbankId) {
        Donation donation = donationRepository.findById(donationId)
                .orElseThrow(() -> new EntityNotFoundException("Donation " + donationId + " not found"));
        User foodbank = userRepository.findById(foodbankId)
                .orElseThrow(() -> new EntityNotFoundException("Foodbank " + foodbankId + " not found"));

        if (foodbank.getRole() != Role.FOODBANK) {
            throw new IllegalArgumentException("Only users with role FOODBANK can claim donations");
        }
        if (donation.getStatus() != DonationStatus.AVAILABLE || claimRepository.existsByDonationId(donationId)) {
            throw new IllegalStateException("Donation " + donationId + " is no longer available");
        }
        LocalDateTime now = LocalDateTime.now();
        if (!FreshnessPolicy.isFresh(donation, now)) {
            throw new IllegalStateException("Donation " + donationId + " is older than "
                    + FreshnessPolicy.MAX_AGE_DAYS + " days and can no longer be claimed");
        }

        donation.setStatus(DonationStatus.CLAIMED);
        donationRepository.save(donation);
        return claimRepository.save(new Claim(donation, foodbank, now));
    }

    public List<Claim> getClaimsForFoodbank(Long foodbankId) {
        return claimRepository.findByFoodbankIdOrderByClaimedAtDesc(foodbankId);
    }

    public List<Claim> getAllClaims() {
        return claimRepository.findAll();
    }
}
