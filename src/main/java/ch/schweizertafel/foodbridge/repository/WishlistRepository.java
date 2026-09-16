package ch.schweizertafel.foodbridge.repository;

import ch.schweizertafel.foodbridge.model.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WishlistRepository extends JpaRepository<Wishlist, Long> {
    List<Wishlist> findAllByOrderByCreatedAtDesc();
}
