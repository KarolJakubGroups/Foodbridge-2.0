package ch.schweizertafel.foodbridge.dto;

import ch.schweizertafel.foodbridge.model.TemperatureRange;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Payload for registering a donation. All 7 business fields are mandatory. */
public record DonationRequest(
        @NotNull Long donorId,
        @NotBlank String productName,
        @NotNull TemperatureRange temperatureRange,
        @NotNull @FutureOrPresent LocalDate bestBeforeDate,
        @NotBlank String pickupAddress,
        @NotNull @Min(1) Integer numberOfPallets,
        @NotNull @Positive Double weightPerPallet,
        @NotNull LocalDateTime overlapStart,
        @NotNull LocalDateTime overlapEnd
) {
}
