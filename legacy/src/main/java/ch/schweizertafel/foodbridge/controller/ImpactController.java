package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.ImpactReport;
import ch.schweizertafel.foodbridge.model.User;
import ch.schweizertafel.foodbridge.service.CurrentUserService;
import ch.schweizertafel.foodbridge.service.ImpactService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/impact")
public class ImpactController {

    private final ImpactService impactService;
    private final CurrentUserService currentUser;

    public ImpactController(ImpactService impactService, CurrentUserService currentUser) {
        this.impactService = impactService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ImpactReport global() {
        return impactService.globalImpact();
    }

    /** Impact attributed to the session user: as donor or as claiming institution. */
    @GetMapping("/mine")
    public ImpactReport mine() {
        User user = currentUser.requireCurrentUser();
        return switch (user.getRole()) {
            case DONOR -> impactService.impactForDonor(user.getId());
            case FOODBANK -> impactService.impactForFoodbank(user.getId());
            case DISPATCHER -> impactService.globalImpact();
        };
    }
}
