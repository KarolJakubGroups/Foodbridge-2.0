package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.ClaimRequest;
import ch.schweizertafel.foodbridge.model.Claim;
import ch.schweizertafel.foodbridge.service.ClaimService;
import ch.schweizertafel.foodbridge.service.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/claims")
public class ClaimController {

    private final ClaimService claimService;
    private final CurrentUserService currentUser;

    public ClaimController(ClaimService claimService, CurrentUserService currentUser) {
        this.claimService = claimService;
        this.currentUser = currentUser;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Claim claim(@Valid @RequestBody ClaimRequest request) {
        return claimService.claimDonation(request.donationId(), currentUser.requireCurrentUser().getId());
    }

    /** Claims of the session user's institution. */
    @GetMapping("/mine")
    public List<Claim> mine() {
        return claimService.getClaimsForFoodbank(currentUser.requireCurrentUser().getId());
    }

    @GetMapping
    public List<Claim> all() {
        return claimService.getAllClaims();
    }
}
