package ch.schweizertafel.foodbridge.dto;

import ch.schweizertafel.foodbridge.model.TemperatureRange;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Payload for registering a donation. All 7 business fields are mandatory; the donor is the session user. */
public record DonationRequest(
        @NotBlank @Size(max = 120) String productName,
        @NotNull TemperatureRange temperatureRange,
        @NotNull @FutureOrPresent LocalDate bestBeforeDate,
        @NotBlank @Size(max = 200) String pickupAddress,
        @NotNull @Min(1) @Max(66) Integer numberOfPallets,
        @NotNull @Positive @Max(1500) Double weightPerPallet,
        @NotNull LocalDateTime overlapStart,
        @NotNull LocalDateTime overlapEnd
) {
}
