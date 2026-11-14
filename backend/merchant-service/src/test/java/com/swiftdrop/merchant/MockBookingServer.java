package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Real loopback HTTP mock for the proposed Member 2 contract; never packaged in production. */
final class MockBookingServer implements AutoCloseable {
    final HttpServer server;
    final ExecutorService executor=Executors.newCachedThreadPool();
    final ObjectMapper json;
    final Map<String,String> bookings=new ConcurrentHashMap<>();
    final AtomicInteger created=new AtomicInteger();
    volatile int responseStatus=201;
    volatile String forcedBody;
    volatile long delayMillis;
    volatile String lastBody,lastKey;
    MockBookingServer(ObjectMapper json) throws Exception {
        this.json=json;
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.setExecutor(executor);
        server.createContext("/api/v1/parcels",exchange->{
            try {
                lastBody=new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8);
                lastKey=exchange.getRequestHeaders().getFirst("Idempotency-Key");
                int code=responseStatus; String body=forcedBody;
                if(!"POST".equals(exchange.getRequestMethod())) { code=405; body="{}"; }
                else if(!"mock-private-service-key".equals(exchange.getRequestHeaders().getFirst("X-SwiftDrop-Service-Key"))) {
                    code=401; body="{\"message\":\"private remote diagnostic\"}";
                } else if(body==null) {
                    var request=json.readTree(lastBody);
                    body=bookings.computeIfAbsent(lastKey,key->{
                        created.incrementAndGet();
                        return "{\"success\":true,\"data\":{\"orderId\":\""+request.path("orderId").asText()+
                            "\",\"parcelId\":\""+UUID.randomUUID()+"\",\"trackingNumber\":\"MOCK-"+created.get()+"\",\"status\":\"CREATED\"}}";
                    });
                }
                if(delayMillis>0) Thread.sleep(delayMillis);
                byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type","application/json");
                exchange.sendResponseHeaders(code,bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch(InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
    }
    URI endpoint() { return URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/api/v1/parcels"); }
    public void close() { server.stop(0); executor.shutdownNow(); }
}
