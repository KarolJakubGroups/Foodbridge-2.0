package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.dto.ImpactReport;
import ch.schweizertafel.foodbridge.model.Claim;
import ch.schweizertafel.foodbridge.model.Donation;
import ch.schweizertafel.foodbridge.model.DonationStatus;
import ch.schweizertafel.foodbridge.repository.ClaimRepository;
import ch.schweizertafel.foodbridge.repository.DonationRepository;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;

/**
 * Impact tracking: rescued weight (pallets * weight per pallet), resulting meals
 * and avoided CO2. A donation counts as rescued once a foodbank has claimed it.
 */
@Service
public class ImpactService {

    /** Schweizer Tafel figure: roughly two meals per kilogram of rescued food. */
    public static final double MEALS_PER_KG = 2.0;
    /** Avoided emissions per kilogram of food not wasted (kg CO2e / kg). */
    public static final double CO2_PER_KG = 1.1;

    public static final EnumSet<DonationStatus> RESCUED_STATES =
            EnumSet.of(DonationStatus.CLAIMED, DonationStatus.BUNDLED, DonationStatus.COMPLETED);

    private final DonationRepository donationRepository;
    private final ClaimRepository claimRepository;

    public ImpactService(DonationRepository donationRepository, ClaimRepository claimRepository) {
        this.donationRepository = donationRepository;
        this.claimRepository = claimRepository;
    }

    public ImpactReport globalImpact() {
        return calculate(donationRepository.findByStatusIn(RESCUED_STATES));
    }

    public ImpactReport impactForDonor(Long donorId) {
        return calculate(donationRepository.findByDonorIdAndStatusIn(donorId, RESCUED_STATES));
    }

    public ImpactReport impactForFoodbank(Long foodbankId) {
        List<Donation> donations = claimRepository.findByFoodbankIdOrderByClaimedAtDesc(foodbankId).stream()
                .map(Claim::getDonation)
                .toList();
        return calculate(donations);
    }

    public static ImpactReport calculate(Collection<Donation> donations) {
        double totalKg = donations.stream().mapToDouble(Donation::getTotalWeightKg).sum();
        long meals = Math.round(totalKg * MEALS_PER_KG);
        double co2 = Math.round(totalKg * CO2_PER_KG * 10.0) / 10.0;
        return new ImpactReport(totalKg, meals, co2, donations.size());
    }
}
