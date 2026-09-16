package ch.schweizertafel.foodbridge.repository;

import ch.schweizertafel.foodbridge.model.Donation;
import ch.schweizertafel.foodbridge.model.DonationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface DonationRepository extends JpaRepository<Donation, Long> {
    List<Donation> findByStatusOrderByCreatedAtDesc(DonationStatus status);
    List<Donation> findByStatusIn(Collection<DonationStatus> statuses);
    List<Donation> findByDonorIdOrderByCreatedAtDesc(Long donorId);
    List<Donation> findByDonorIdAndStatusIn(Long donorId, Collection<DonationStatus> statuses);
    List<Donation> findByStatusAndTransportOrderIsNull(DonationStatus status);
}
