package ch.schweizertafel.foodbridge.dto;

import jakarta.validation.constraints.NotBlank;

public record DriverAssignmentRequest(@NotBlank String driverName) {
}
