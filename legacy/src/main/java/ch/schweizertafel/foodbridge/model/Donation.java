package ch.schweizertafel.foodbridge.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A food donation registered by a retailer (DONOR). Carries the 7 mandatory
 * fields required by Schweizer Tafel: productName, temperatureRange,
 * bestBeforeDate, pickupAddress, numberOfPallets, weightPerPallet and the
 * pickup window (overlapStart / overlapEnd).
 */
@Entity
@Table(name = "donations")
public class Donation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "donor_id")
    private User donor;

    @Column(nullable = false)
    private String productName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TemperatureRange temperatureRange;

    @Column(nullable = false)
    private LocalDate bestBeforeDate;

    @Column(nullable = false)
    private String pickupAddress;

    @Column(nullable = false)
    private Integer numberOfPallets;

    @Column(nullable = false)
    private Double weightPerPallet;

    /** Start of the pickup window (Abholzeitfenster Beginn). */
    @Column(nullable = false)
    private LocalDateTime overlapStart;

    /** End of the pickup window (Abholzeitfenster Ende). */
    @Column(nullable = false)
    private LocalDateTime overlapEnd;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DonationStatus status = DonationStatus.AVAILABLE;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "transport_order_id")
    private TransportOrder transportOrder;

    protected Donation() {
    }

    public Donation(User donor, String productName, TemperatureRange temperatureRange, LocalDate bestBeforeDate,
                    String pickupAddress, Integer numberOfPallets, Double weightPerPallet,
                    LocalDateTime overlapStart, LocalDateTime overlapEnd, LocalDateTime createdAt) {
        this.donor = donor;
        this.productName = productName;
        this.temperatureRange = temperatureRange;
        this.bestBeforeDate = bestBeforeDate;
        this.pickupAddress = pickupAddress;
        this.numberOfPallets = numberOfPallets;
        this.weightPerPallet = weightPerPallet;
        this.overlapStart = overlapStart;
        this.overlapEnd = overlapEnd;
        this.createdAt = createdAt;
    }

    @JsonProperty("totalWeightKg")
    public double getTotalWeightKg() {
        if (numberOfPallets == null || weightPerPallet == null) return 0;
        return numberOfPallets * weightPerPallet;
    }

    @JsonProperty("transportOrderId")
    public Long getTransportOrderId() {
        return transportOrder == null ? null : transportOrder.getId();
    }

    public Long getId() { return id; }
    public User getDonor() { return donor; }
    public String getProductName() { return productName; }
    public TemperatureRange getTemperatureRange() { return temperatureRange; }
    public LocalDate getBestBeforeDate() { return bestBeforeDate; }
    public String getPickupAddress() { return pickupAddress; }
    public Integer getNumberOfPallets() { return numberOfPallets; }
    public Double getWeightPerPallet() { return weightPerPallet; }
    public LocalDateTime getOverlapStart() { return overlapStart; }
    public LocalDateTime getOverlapEnd() { return overlapEnd; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public DonationStatus getStatus() { return status; }
    public TransportOrder getTransportOrder() { return transportOrder; }

    public void setStatus(DonationStatus status) { this.status = status; }
    public void setTransportOrder(TransportOrder transportOrder) { this.transportOrder = transportOrder; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
