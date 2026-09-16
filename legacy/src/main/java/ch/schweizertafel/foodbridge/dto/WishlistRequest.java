package ch.schweizertafel.foodbridge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record WishlistRequest(
        @NotBlank @Size(max = 120) String productName,
        @NotNull @Positive Double quantityKg,
        @Size(max = 300) String note
) {
}
