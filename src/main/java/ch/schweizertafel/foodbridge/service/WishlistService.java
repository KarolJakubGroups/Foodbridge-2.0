package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.dto.WishlistRequest;
import ch.schweizertafel.foodbridge.model.Role;
import ch.schweizertafel.foodbridge.model.User;
import ch.schweizertafel.foodbridge.model.Wishlist;
import ch.schweizertafel.foodbridge.repository.UserRepository;
import ch.schweizertafel.foodbridge.repository.WishlistRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;

    public WishlistService(WishlistRepository wishlistRepository, UserRepository userRepository) {
        this.wishlistRepository = wishlistRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Wishlist create(WishlistRequest request) {
        User foodbank = userRepository.findById(request.foodbankId())
                .orElseThrow(() -> new EntityNotFoundException("Foodbank " + request.foodbankId() + " not found"));
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
    public void delete(Long id) {
        if (!wishlistRepository.existsById(id)) {
            throw new EntityNotFoundException("Wishlist entry " + id + " not found");
        }
        wishlistRepository.deleteById(id);
    }
}
