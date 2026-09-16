package ch.schweizertafel.foodbridge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record WishlistRequest(
        @NotNull Long foodbankId,
        @NotBlank String productName,
        @NotNull @Positive Double quantityKg,
        String note
) {
}
