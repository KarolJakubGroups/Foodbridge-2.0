package ch.schweizertafel.foodbridge.dto;

import ch.schweizertafel.foodbridge.model.Role;
import ch.schweizertafel.foodbridge.model.User;

public record UserView(Long id, String username, Role role, String organizationName, String address) {
    public static UserView from(User u) {
        return new UserView(u.getId(), u.getUsername(), u.getRole(), u.getOrganizationName(), u.getAddress());
    }
}
