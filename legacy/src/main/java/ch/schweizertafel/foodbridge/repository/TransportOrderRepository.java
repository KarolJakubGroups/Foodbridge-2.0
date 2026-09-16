package ch.schweizertafel.foodbridge.repository;

import ch.schweizertafel.foodbridge.model.TransportOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransportOrderRepository extends JpaRepository<TransportOrder, Long> {
    List<TransportOrder> findAllByOrderByPickupTimeAsc();
}
