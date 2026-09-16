package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.DriverAssignmentRequest;
import ch.schweizertafel.foodbridge.dto.StatusUpdateRequest;
import ch.schweizertafel.foodbridge.model.TransportOrder;
import ch.schweizertafel.foodbridge.service.LogisticsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/logistics")
public class LogisticsController {

    private final LogisticsService logisticsService;

    public LogisticsController(LogisticsService logisticsService) {
        this.logisticsService = logisticsService;
    }

    /** Runs the Galliker consolidation and returns the newly created orders. */
    @PostMapping("/bundle")
    public List<TransportOrder> bundle() {
        return logisticsService.generateTransportOrders();
    }

    @GetMapping("/orders")
    public List<TransportOrder> orders() {
        return logisticsService.getAllOrders();
    }

    @PatchMapping("/orders/{id}/status")
    public TransportOrder updateStatus(@PathVariable Long id, @Valid @RequestBody StatusUpdateRequest request) {
        return logisticsService.updateStatus(id, request.status());
    }

    @PatchMapping("/orders/{id}/driver")
    public TransportOrder assignDriver(@PathVariable Long id, @Valid @RequestBody DriverAssignmentRequest request) {
        return logisticsService.assignDriver(id, request.driverName());
    }
}
