package com.swiftdrop.merchant.client;

import java.net.URI;
import java.util.Map;

public interface WebhookTransport {
    int send(URI target,Map<String,String> headers,String payload) throws java.io.IOException;
}
