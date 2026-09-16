package ch.schweizertafel.foodbridge.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** 1:1 assignment of a donation to the social institution (FOODBANK) that picks it up. */
@Entity
@Table(name = "claims")
public class Claim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "donation_id", unique = true)
    private Donation donation;

    @ManyToOne(optional = false)
    @JoinColumn(name = "foodbank_id")
    private User foodbank;

    @Column(nullable = false)
    private LocalDateTime claimedAt;

    protected Claim() {
    }

    public Claim(Donation donation, User foodbank, LocalDateTime claimedAt) {
        this.donation = donation;
        this.foodbank = foodbank;
        this.claimedAt = claimedAt;
    }

    public Long getId() { return id; }
    public Donation getDonation() { return donation; }
    public User getFoodbank() { return foodbank; }
    public LocalDateTime getClaimedAt() { return claimedAt; }
}
