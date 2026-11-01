package com.swiftdrop.merchant.client;

import java.util.UUID;
public interface IdentityGateway {
    record Caller(UUID id,String role){}
    Caller validate(String bearer);
    void grantMerchant(String bearer,UUID application,UUID applicant);
}
