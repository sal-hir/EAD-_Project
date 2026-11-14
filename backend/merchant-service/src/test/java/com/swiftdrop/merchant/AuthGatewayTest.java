package com.swiftdrop.merchant;

import com.sun.net.httpserver.HttpServer;
import com.swiftdrop.merchant.client.AuthGateway;
import com.swiftdrop.merchant.exception.ApiFailure;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;

class AuthGatewayTest {
    HttpServer auth;String base;UUID id=UUID.randomUUID();AtomicInteger status=new AtomicInteger(200);String key="test-only-internal-merchant-secret-never-deploy";
    boolean active=true;String role="MERCHANT";java.util.concurrent.atomic.AtomicReference<String> seenAuthorization=new java.util.concurrent.atomic.AtomicReference<>();
    @BeforeEach void start()throws Exception{
        auth=HttpServer.create(new InetSocketAddress("localhost",0),0);base="http://localhost:"+auth.getAddress().getPort();
        auth.createContext("/api/v1/auth/",exchange->{
            String authorization=exchange.getRequestHeaders().getFirst("Authorization");
            seenAuthorization.set(authorization);
            boolean machine=exchange.getRequestURI().getPath().endsWith("/merchant-api/identity");
            int code=status.get();if(!machine&&!"Bearer opaque-verified-by-auth".equals(authorization))code=401;
            boolean grant=exchange.getRequestURI().getPath().contains("internal/");
            if(grant&&!key.equals(exchange.getRequestHeaders().getFirst("X-SwiftDrop-Service-Key")))code=403;
            String payload="{\"success\":true,\"data\":{\"id\":\""+id+"\",\"role\":\""+role+"\",\"active\":"+active+"}}";
            byte[] bytes=payload.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(code,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });auth.start();
    }
    @AfterEach void stop(){auth.stop(0);}
    @Test void forwardsBearerAndPrivateCredentialOverHttpAndValidatesResponse(){
        var gateway=new AuthGateway(base,key);assertThat(gateway.validate("opaque-verified-by-auth").id()).isEqualTo(id);
        gateway.grantMerchant("opaque-verified-by-auth",UUID.randomUUID(),id);
        assertThatThrownBy(()->gateway.grantMerchant("opaque-verified-by-auth",UUID.randomUUID(),UUID.randomUUID())).isInstanceOf(ApiFailure.class);
    }
    @Test void invalidOrRevokedBearerAndAuthOutageFailClosed(){
        var gateway=new AuthGateway(base,key);
        assertThatThrownBy(()->gateway.validate("forged")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(401));
        status.set(503);assertThatThrownBy(()->gateway.validate("opaque-verified-by-auth")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
        assertThatThrownBy(()->gateway.grantMerchant("opaque-verified-by-auth",UUID.randomUUID(),id)).isInstanceOf(ApiFailure.class);
    }
    @Test void requiresHttpsOutsideLocalhostAndConfiguredServiceKey(){
        assertThatThrownBy(()->new AuthGateway("http://auth.example.com",key)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new AuthGateway(base,"").grantMerchant("opaque-verified-by-auth",UUID.randomUUID(),id)).isInstanceOf(ApiFailure.class);
    }
    @Test void dockerHttpRequiresExplicitOptInAndExactServiceHostname(){
        assertThatThrownBy(()->new AuthGateway("http://auth-service:4000",key)).isInstanceOf(IllegalArgumentException.class);
        assertThatCode(()->new AuthGateway("http://auth-service:4000",key,true)).doesNotThrowAnyException();
        assertThatThrownBy(()->new AuthGateway("http://auth.example.com",key,true)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new AuthGateway("http://auth-service.attacker.example",key,true)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void machineIdentityLookupUsesServiceCredentialWithoutABrowserBearer(){
        var gateway=new AuthGateway(base,key);
        assertThatCode(()->gateway.requireActiveMerchant(id)).doesNotThrowAnyException();
        assertThat(seenAuthorization.get()).isNull();
        assertThatThrownBy(()->new AuthGateway(base,"wrong-secret-with-at-least-32-characters").requireActiveMerchant(id))
            .isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
    }
    @Test void machineIdentityChecksCurrentRoleActiveStateAndMatchingUser(){
        var gateway=new AuthGateway(base,key);
        active=false;assertThatThrownBy(()->gateway.requireActiveMerchant(id)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(401));
        active=true;role="CUSTOMER";assertThatThrownBy(()->gateway.requireActiveMerchant(id)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(401));
        role="MERCHANT";assertThatThrownBy(()->gateway.requireActiveMerchant(UUID.randomUUID())).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
    }
    @Test void machineIdentityOutageAndMissingServiceConfigurationFailClosed(){
        var gateway=new AuthGateway(base,key);
        status.set(503);assertThatThrownBy(()->gateway.requireActiveMerchant(id)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
        status.set(404);assertThatThrownBy(()->gateway.requireActiveMerchant(id)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(401));
        assertThatThrownBy(()->new AuthGateway(base,"").requireActiveMerchant(id)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
    }
}
