package ch.schweizertafel.foodbridge.repository;

import ch.schweizertafel.foodbridge.model.Claim;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClaimRepository extends JpaRepository<Claim, Long> {
    List<Claim> findByFoodbankIdOrderByClaimedAtDesc(Long foodbankId);
    boolean existsByDonationId(Long donationId);
}
