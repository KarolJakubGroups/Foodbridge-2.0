package ch.schweizertafel.foodbridge.dto;

import ch.schweizertafel.foodbridge.model.TransportStatus;
import jakarta.validation.constraints.NotNull;

public record StatusUpdateRequest(@NotNull TransportStatus status) {
}
