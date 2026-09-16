package ch.schweizertafel.foodbridge.service;

import ch.schweizertafel.foodbridge.dto.UserView;
import ch.schweizertafel.foodbridge.model.User;
import ch.schweizertafel.foodbridge.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** Demo login: plain credential check against the seeded accounts. */
    public UserView login(String username, String password) {
        User user = userRepository.findByUsername(username.trim().toLowerCase())
                .filter(u -> u.getPassword().equals(password))
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));
        return UserView.from(user);
    }

    public List<UserView> listAccounts() {
        return userRepository.findAll().stream().map(UserView::from).toList();
    }
}
