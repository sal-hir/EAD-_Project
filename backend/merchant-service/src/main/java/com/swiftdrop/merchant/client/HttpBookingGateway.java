package com.swiftdrop.merchant.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.merchant.exception.ApiFailure;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;

/** Contract candidate exercised against the test mock only. Deliberately not a Spring bean. */
public final class HttpBookingGateway implements BookingGateway {
    private final URI endpoint;
    private final String serviceKey;
    private final ObjectMapper json;
    private final Duration timeout;
    private final HttpClient client;
    public HttpBookingGateway(URI endpoint,String serviceKey,ObjectMapper json,Duration timeout) {
        boolean loopback="localhost".equals(endpoint.getHost()) || "127.0.0.1".equals(endpoint.getHost()) || "[::1]".equals(endpoint.getHost());
        if(endpoint.getHost()==null || endpoint.getRawUserInfo()!=null || endpoint.getRawQuery()!=null || endpoint.getRawFragment()!=null
                || !("https".equals(endpoint.getScheme()) || ("http".equals(endpoint.getScheme()) && loopback)))
            throw new IllegalArgumentException("Booking endpoint requires HTTPS (loopback HTTP permitted for tests)");
        if(serviceKey==null || serviceKey.isBlank() || serviceKey.indexOf('\r')>=0 || serviceKey.indexOf('\n')>=0)
            throw new IllegalArgumentException("Private booking service credential required");
        if(timeout==null || timeout.isNegative() || timeout.isZero()) throw new IllegalArgumentException("Positive timeout required");
        this.endpoint=endpoint; this.serviceKey=serviceKey; this.json=json; this.timeout=timeout;
        client=HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }
    @Override public Booking create(Request request) {
        try {
            var http=HttpRequest.newBuilder(endpoint).timeout(timeout).header("Content-Type","application/json")
                .header("Accept","application/json").header("X-SwiftDrop-Service-Key",serviceKey)
                .header("Idempotency-Key",request.orderId().toString())
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(request))).build();
            var response=client.send(http,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200 && response.statusCode()!=201) throw new ApiFailure(503,"Booking temporarily unavailable");
            var root=json.readTree(response.body());
            if(root==null || !root.path("success").asBoolean(false)) throw new ApiFailure(503,"Invalid booking response");
            Booking booking=json.treeToValue(root.path("data"),Booking.class);
            if(booking==null || !request.orderId().equals(booking.orderId()) || booking.parcelId()==null
                    || booking.trackingNumber()==null || !booking.trackingNumber().matches("[A-Za-z0-9_-]{1,100}")
                    || !"CREATED".equals(booking.status())) throw new ApiFailure(503,"Invalid booking response");
            return booking;
        } catch(InterruptedException e) {
            Thread.currentThread().interrupt(); throw new ApiFailure(503,"Booking temporarily unavailable");
        } catch(java.io.IOException e) {
            // No remote error bodies or credentials are propagated or logged.
            throw new ApiFailure(503,"Booking temporarily unavailable");
        }
    }
}
