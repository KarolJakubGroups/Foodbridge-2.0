package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.model.*;
import ch.schweizertafel.foodbridge.repository.DonationRepository;
import ch.schweizertafel.foodbridge.repository.TransportOrderRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Galliker consolidation: bundles CLAIMED donations of the same donor whose
 * pickup windows overlap into a single {@link TransportOrder}.
 *
 * <p>Algorithm (interval scheduling / point stabbing): donations are sorted by
 * the end of their window. The first donation opens a bundle whose reference
 * end is its own window end. Every following donation whose window starts at or
 * before that reference end shares a common point in time with all donations
 * already in the bundle and is therefore added. The first donation that starts
 * after the reference end opens a new bundle. This yields the minimum number of
 * pickups in O(n log n).</p>
 */
@Service
public class LogisticsService {

    /** Pickup of a Galliker order is normalised to noon on the intersection day. */
    public static final LocalTime PICKUP_TIME = LocalTime.NOON;

    private final DonationRepository donationRepository;
    private final TransportOrderRepository transportOrderRepository;

    public LogisticsService(DonationRepository donationRepository, TransportOrderRepository transportOrderRepository) {
        this.donationRepository = donationRepository;
        this.transportOrderRepository = transportOrderRepository;
    }

    /** Runs the consolidation over all CLAIMED donations that are not yet part of an order. */
    @Transactional
    public List<TransportOrder> generateTransportOrders() {
        List<Donation> claimed = donationRepository.findByStatusAndTransportOrderIsNull(DonationStatus.CLAIMED);

        Map<Long, List<Donation>> donationsByDonor = new LinkedHashMap<>();
        for (Donation d : claimed) {
            donationsByDonor.computeIfAbsent(d.getDonor().getId(), id -> new ArrayList<>()).add(d);
        }

        List<TransportOrder> orders = new ArrayList<>();
        for (List<Donation> donorDonations : donationsByDonor.values()) {
            orders.addAll(calculateBundlesForDonor(donorDonations.get(0).getDonor(), donorDonations));
        }
        return orders;
    }

    private List<TransportOrder> calculateBundlesForDonor(User donor, List<Donation> donations) {
        List<TransportOrder> orders = new ArrayList<>();
        for (List<Donation> bundle : partitionIntoBundles(donations)) {
            // reference end = smallest window end in the bundle (first element after sorting)
            LocalDateTime bundleCurrentEnd = bundle.get(0).getOverlapEnd();
            orders.add(createAndSaveOrder(donor, bundle, bundleCurrentEnd));
        }
        return orders;
    }

    /**
     * Pure bundling step (no persistence) so it can be unit-tested in isolation.
     * Returns the bundles in chronological order; within each bundle the
     * donations are sorted by window end, so element 0 defines the reference end.
     */
    static List<List<Donation>> partitionIntoBundles(List<Donation> input) {
        if (input.isEmpty()) return Collections.emptyList();

        List<Donation> donations = new ArrayList<>(input);
        donations.sort(Comparator.comparing(Donation::getOverlapEnd));

        List<List<Donation>> bundles = new ArrayList<>();
        List<Donation> currentBundle = new ArrayList<>();
        LocalDateTime bundleCurrentEnd = null;

        for (Donation donation : donations) {
            if (currentBundle.isEmpty()) {
                currentBundle.add(donation);
                bundleCurrentEnd = donation.getOverlapEnd();
            } else if (donation.getOverlapStart().compareTo(bundleCurrentEnd) <= 0) {
                // starts at or before the reference end -> overlaps with the whole bundle
                currentBundle.add(donation);
            } else {
                bundles.add(currentBundle);
                currentBundle = new ArrayList<>();
                currentBundle.add(donation);
                bundleCurrentEnd = donation.getOverlapEnd();
            }
        }
        if (!currentBundle.isEmpty()) {
            bundles.add(currentBundle);
        }
        return bundles;
    }

    private TransportOrder createAndSaveOrder(User donor, List<Donation> bundle, LocalDateTime bundleCurrentEnd) {
        LocalDateTime pickupTime = bundleCurrentEnd.toLocalDate().atTime(PICKUP_TIME);
        TransportOrder order = transportOrderRepository.save(new TransportOrder(donor, pickupTime, LocalDateTime.now()));
        for (Donation donation : bundle) {
            donation.setTransportOrder(order);
            donation.setStatus(DonationStatus.BUNDLED);
            donationRepository.save(donation);
            order.getDonations().add(donation);
        }
        return order;
    }

    public List<TransportOrder> getAllOrders() {
        return transportOrderRepository.findAllByOrderByPickupTimeAsc();
    }

    @Transactional
    public TransportOrder updateStatus(Long orderId, TransportStatus status) {
        TransportOrder order = getOrder(orderId);
        order.setStatus(status);
        if (status == TransportStatus.COMPLETED) {
            for (Donation d : order.getDonations()) {
                d.setStatus(DonationStatus.COMPLETED);
                donationRepository.save(d);
            }
        }
        return transportOrderRepository.save(order);
    }

    @Transactional
    public TransportOrder assignDriver(Long orderId, String driverName) {
        TransportOrder order = getOrder(orderId);
        order.setDriverName(driverName.trim());
        return transportOrderRepository.save(order);
    }

    private TransportOrder getOrder(Long orderId) {
        return transportOrderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Transport order " + orderId + " not found"));
    }
}
