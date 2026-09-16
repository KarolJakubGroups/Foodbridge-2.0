package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.ImpactReport;
import ch.schweizertafel.foodbridge.service.ImpactService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/impact")
public class ImpactController {

    private final ImpactService impactService;

    public ImpactController(ImpactService impactService) {
        this.impactService = impactService;
    }

    @GetMapping
    public ImpactReport global() {
        return impactService.globalImpact();
    }

    @GetMapping("/donor/{donorId}")
    public ImpactReport forDonor(@PathVariable Long donorId) {
        return impactService.impactForDonor(donorId);
    }

    @GetMapping("/foodbank/{foodbankId}")
    public ImpactReport forFoodbank(@PathVariable Long foodbankId) {
        return impactService.impactForFoodbank(foodbankId);
    }
}
