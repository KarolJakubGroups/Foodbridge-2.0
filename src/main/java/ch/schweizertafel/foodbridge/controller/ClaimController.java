package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.ClaimRequest;
import ch.schweizertafel.foodbridge.model.Claim;
import ch.schweizertafel.foodbridge.service.ClaimService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/claims")
public class ClaimController {

    private final ClaimService claimService;

    public ClaimController(ClaimService claimService) {
        this.claimService = claimService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Claim claim(@Valid @RequestBody ClaimRequest request) {
        return claimService.claimDonation(request.donationId(), request.foodbankId());
    }

    @GetMapping("/foodbank/{foodbankId}")
    public List<Claim> forFoodbank(@PathVariable Long foodbankId) {
        return claimService.getClaimsForFoodbank(foodbankId);
    }

    @GetMapping
    public List<Claim> all() {
        return claimService.getAllClaims();
    }
}
