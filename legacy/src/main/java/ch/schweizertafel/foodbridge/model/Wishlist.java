package ch.schweizertafel.foodbridge.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** A published need of a social institution (e.g. "200 kg rice"). */
@Entity
@Table(name = "wishlists")
public class Wishlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "foodbank_id")
    private User foodbank;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private Double quantityKg;

    private String note;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    protected Wishlist() {
    }

    public Wishlist(User foodbank, String productName, Double quantityKg, String note, LocalDateTime createdAt) {
        this.foodbank = foodbank;
        this.productName = productName;
        this.quantityKg = quantityKg;
        this.note = note;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public User getFoodbank() { return foodbank; }
    public String getProductName() { return productName; }
    public Double getQuantityKg() { return quantityKg; }
    public String getNote() { return note; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
