package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.dto.WishlistRequest;
import ch.schweizertafel.foodbridge.model.Role;
import ch.schweizertafel.foodbridge.model.User;
import ch.schweizertafel.foodbridge.model.Wishlist;
import ch.schweizertafel.foodbridge.repository.WishlistRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    public WishlistService(WishlistRepository wishlistRepository) {
        this.wishlistRepository = wishlistRepository;
    }

    @Transactional
    public Wishlist create(User foodbank, WishlistRequest request) {
        if (foodbank.getRole() != Role.FOODBANK) {
            throw new IllegalArgumentException("Only users with role FOODBANK can publish needs");
        }
        return wishlistRepository.save(new Wishlist(foodbank, request.productName().trim(), request.quantityKg(),
                request.note(), LocalDateTime.now()));
    }

    public List<Wishlist> getAll() {
        return wishlistRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public void delete(User foodbank, Long id) {
        Wishlist entry = wishlistRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Wishlist entry " + id + " not found"));
        if (!entry.getFoodbank().getId().equals(foodbank.getId())) {
            throw new IllegalArgumentException("Wishlist entry belongs to another institution");
        }
        wishlistRepository.delete(entry);
    }
}
