package ch.schweizertafel.foodbridge.dto;

import jakarta.validation.constraints.NotNull;

public record ClaimRequest(@NotNull Long donationId, @NotNull Long foodbankId) {
}
