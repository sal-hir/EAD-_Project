package com.swiftdrop.auth.service;

import com.swiftdrop.auth.dto.AuthDtos.*;
import com.swiftdrop.auth.entity.User;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.UserRepository;
import com.swiftdrop.auth.security.JwtService;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuthenticationManager authentication;
    private final JwtService jwt;
    public AuthService(UserRepository users, PasswordEncoder passwords, AuthenticationManager authentication, JwtService jwt) {
        this.users = users; this.passwords = passwords; this.authentication = authentication; this.jwt = jwt;
    }
    public static String normalize(String email) { return email.strip().toLowerCase(Locale.ROOT); }
    @Transactional
    public Profile register(RegisterRequest request) {
        String email = normalize(request.email());
        if (users.existsByEmail(email)) throw new ApiException(HttpStatus.CONFLICT, "Account already exists");
        User user = new User(request.name().strip(), email, passwords.encode(request.password()), request.phone());
        return Profile.from(users.saveAndFlush(user));
    }
    @Transactional(readOnly = true)
    public LoginResult login(LoginRequest request) {
        String email = normalize(request.email());
        authentication.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(email, request.password()));
        return jwt.issue(users.findByEmail(email).orElseThrow(() -> new BadCredentialsException("Invalid credentials")));
    }
    @Transactional(readOnly = true)
    public User current(UUID id) {
        return users.findById(id).filter(User::isActive)
            .orElseThrow(() -> new BadCredentialsException("Account unavailable"));
    }
}
