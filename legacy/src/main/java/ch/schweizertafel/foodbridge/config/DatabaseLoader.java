package ch.schweizertafel.foodbridge.config;

import ch.schweizertafel.foodbridge.model.*;
import ch.schweizertafel.foodbridge.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Seeds the in-memory database on every start with demo accounts and donations
 * so that every role dashboard has meaningful data.
 */
@Component
public class DatabaseLoader implements CommandLineRunner {

    public static final String DEMO_PASSWORD = "password";

    private final UserRepository users;
    private final DonationRepository donations;
    private final ClaimRepository claims;
    private final WishlistRepository wishlists;
    private final PasswordEncoder passwordEncoder;

    public DatabaseLoader(UserRepository users, DonationRepository donations, ClaimRepository claims,
                          WishlistRepository wishlists, PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
        this.users = users;
        this.donations = donations;
        this.claims = claims;
        this.wishlists = wishlists;
    }

    @Override
    public void run(String... args) {
        if (users.count() > 0) return;
        String hashed = passwordEncoder.encode(DEMO_PASSWORD);

        User migros = users.save(new User("migros", hashed, Role.DONOR, "Migros Genossenschaft Zürich",
                "Limmatstrasse 152, 8005 Zürich"));
        User coop = users.save(new User("coop", hashed, Role.DONOR, "Coop Verteilzentrale Dietikon",
                "Riedstrasse 10, 8953 Dietikon"));
        User foodbank = users.save(new User("foodbank_zrh", hashed, Role.FOODBANK,
                "Schweizer Tafel Abgabestelle Zürich", "Hohlstrasse 400, 8048 Zürich"));
        users.save(new User("dispatcher_gt", hashed, Role.DISPATCHER, "Galliker Transport AG",
                "Kantonsstrasse 2, 6246 Altishofen"));

        LocalDateTime now = LocalDateTime.now().withSecond(0).withNano(0);
        LocalDateTime base = now.toLocalDate().atTime(9, 0);

        // Migros: Apples and Pears overlap (-> one Galliker order), Oranges are disjoint (-> second order)
        Donation apples = seed(migros, "Äpfel Gala", TemperatureRange.AMBIENT, 12, 1, 50.0,
                base.plusDays(1), base.plusDays(3), now, DonationStatus.CLAIMED);
        Donation pears = seed(migros, "Birnen", TemperatureRange.AMBIENT, 10, 1, 30.0,
                base.plusDays(2), base.plusDays(4), now, DonationStatus.CLAIMED);
        Donation oranges = seed(migros, "Orangen", TemperatureRange.AMBIENT, 14, 1, 40.0,
                base.plusDays(4), base.plusDays(5), now, DonationStatus.CLAIMED);
        seed(migros, "Brot vom Vortag", TemperatureRange.AMBIENT, 2, 1, 20.0,
                base.plusDays(1), base.plusDays(2), now.minusHours(3), DonationStatus.AVAILABLE);

        // Coop
        Donation bananas = seed(coop, "Bananen", TemperatureRange.CHILLED, 6, 1, 30.0,
                base.plusDays(1), base.plusDays(4), now.minusDays(1), DonationStatus.CLAIMED);
        seed(coop, "Milch UHT 1l", TemperatureRange.CHILLED, 20, 2, 50.0,
                base.plusDays(1), base.plusDays(5), now.minusHours(6), DonationStatus.AVAILABLE);
        seed(coop, "Tiefkühl-Gemüse", TemperatureRange.FROZEN, 90, 1, 250.0,
                base.plusDays(2), base.plusDays(3), now.minusHours(1), DonationStatus.AVAILABLE);
        // Older than 4 days -> must be hidden from the foodbank dashboard (freshness rule)
        seed(coop, "Joghurt Nature", TemperatureRange.CHILLED, 5, 1, 60.0,
                base.plusDays(1), base.plusDays(2), now.minusDays(5), DonationStatus.AVAILABLE);

        LocalDateTime claimedAt = now.minusHours(2);
        claims.save(new Claim(apples, foodbank, claimedAt));
        claims.save(new Claim(pears, foodbank, claimedAt));
        claims.save(new Claim(oranges, foodbank, claimedAt));
        claims.save(new Claim(bananas, foodbank, claimedAt));

        wishlists.save(new Wishlist(foodbank, "Reis", 200.0, "Langkornreis, ambient", now.minusDays(1)));
        wishlists.save(new Wishlist(foodbank, "Milchprodukte", 100.0, "Joghurt, Käse (gekühlt)", now.minusHours(5)));
    }

    private Donation seed(User donor, String product, TemperatureRange temp, int bestBeforeInDays, int pallets,
                          double weightPerPallet, LocalDateTime start, LocalDateTime end, LocalDateTime createdAt,
                          DonationStatus status) {
        Donation d = new Donation(donor, product, temp, LocalDate.now().plusDays(bestBeforeInDays),
                donor.getAddress(), pallets, weightPerPallet, start, end, createdAt);
        d.setStatus(status);
        return donations.save(d);
    }
}
