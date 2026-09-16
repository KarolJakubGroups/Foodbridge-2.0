package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.dto.UserView;
import ch.schweizertafel.foodbridge.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserView viewOf(String username) {
        return userRepository.findByUsername(username).map(UserView::from)
                .orElseThrow(() -> new IllegalStateException("Unknown user " + username));
    }

    /** Public directory of accounts (no credentials) for the demo quick-select. */
    public List<UserView> listAccounts() {
        return userRepository.findAll().stream().map(UserView::from).toList();
    }
}
