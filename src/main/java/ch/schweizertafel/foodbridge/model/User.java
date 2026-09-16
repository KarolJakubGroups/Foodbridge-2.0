package ch.schweizertafel.foodbridge.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private String organizationName;

    private String address;

    protected User() {
    }

    public User(String username, String password, Role role, String organizationName, String address) {
        this.username = username;
        this.password = password;
        this.role = role;
        this.organizationName = organizationName;
        this.address = address;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getPassword() { return password; }
    public Role getRole() { return role; }
    public String getOrganizationName() { return organizationName; }
    public String getAddress() { return address; }
}
