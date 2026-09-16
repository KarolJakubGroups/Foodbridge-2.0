package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.dto.LoginRequest;
import ch.schweizertafel.foodbridge.dto.UserView;
import ch.schweizertafel.foodbridge.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public UserView login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request.username(), request.password());
    }

    /** Preconfigured accounts for the quick role switch in the UI. */
    @GetMapping("/accounts")
    public List<UserView> accounts() {
        return userService.listAccounts();
    }
}
