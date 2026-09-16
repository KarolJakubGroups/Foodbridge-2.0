package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.WishlistRequest;
import ch.schweizertafel.foodbridge.model.Wishlist;
import ch.schweizertafel.foodbridge.service.WishlistService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishlists")
public class WishlistController {

    private final WishlistService wishlistService;

    public WishlistController(WishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @GetMapping
    public List<Wishlist> all() {
        return wishlistService.getAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Wishlist create(@Valid @RequestBody WishlistRequest request) {
        return wishlistService.create(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        wishlistService.delete(id);
    }
}
