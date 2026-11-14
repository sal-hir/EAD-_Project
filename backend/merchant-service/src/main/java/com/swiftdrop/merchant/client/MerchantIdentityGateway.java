package com.swiftdrop.merchant.client;

import java.util.UUID;

/** Verifies current account state without persisting a merchant's browser JWT. */
public interface MerchantIdentityGateway {
    void requireActiveMerchant(UUID userId);
}
