package ch.schweizertafel.foodbridge.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** A consolidated pickup order for Galliker Logistics bundling several donations of one donor. */
@Entity
@Table(name = "transport_orders")
public class TransportOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "donor_id")
    private User donor;

    /** Normalised pickup time: 12:00 on the day the pickup windows intersect. */
    @Column(nullable = false)
    private LocalDateTime pickupTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransportStatus status = TransportStatus.PENDING;

    private String driverName;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "transportOrder", fetch = FetchType.EAGER)
    @OrderBy("overlapEnd ASC")
    private List<Donation> donations = new ArrayList<>();

    protected TransportOrder() {
    }

    public TransportOrder(User donor, LocalDateTime pickupTime, LocalDateTime createdAt) {
        this.donor = donor;
        this.pickupTime = pickupTime;
        this.createdAt = createdAt;
    }

    @JsonProperty("totalWeightKg")
    public double getTotalWeightKg() {
        return donations.stream().mapToDouble(Donation::getTotalWeightKg).sum();
    }

    @JsonProperty("totalPallets")
    public int getTotalPallets() {
        return donations.stream().mapToInt(d -> d.getNumberOfPallets() == null ? 0 : d.getNumberOfPallets()).sum();
    }

    public Long getId() { return id; }
    public User getDonor() { return donor; }
    public LocalDateTime getPickupTime() { return pickupTime; }
    public TransportStatus getStatus() { return status; }
    public String getDriverName() { return driverName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<Donation> getDonations() { return donations; }

    public void setStatus(TransportStatus status) { this.status = status; }
    public void setDriverName(String driverName) { this.driverName = driverName; }
}
