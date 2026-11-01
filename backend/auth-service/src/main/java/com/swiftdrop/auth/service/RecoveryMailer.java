package com.swiftdrop.auth.service;

public interface RecoveryMailer {
    void send(String email,String resetUrl);
}
