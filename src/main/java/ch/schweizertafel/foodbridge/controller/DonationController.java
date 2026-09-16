package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.DonationRequest;
import ch.schweizertafel.foodbridge.model.Donation;
import ch.schweizertafel.foodbridge.service.DonationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/donations")
public class DonationController {

    private final DonationService donationService;

    public DonationController(DonationService donationService) {
        this.donationService = donationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Donation create(@Valid @RequestBody DonationRequest request) {
        return donationService.createDonation(request);
    }

    /** Donations visible to foodbanks: AVAILABLE and created within the last 4 days. */
    @GetMapping("/available")
    public List<Donation> getAvailableDonations() {
        return donationService.getAvailableDonations();
    }

    @GetMapping("/donor/{donorId}")
    public List<Donation> getForDonor(@PathVariable Long donorId) {
        return donationService.getDonationsForDonor(donorId);
    }

    @GetMapping
    public List<Donation> getAll() {
        return donationService.getAllDonations();
    }

    @GetMapping("/{id}")
    public Donation getOne(@PathVariable Long id) {
        return donationService.getDonation(id);
    }
}
