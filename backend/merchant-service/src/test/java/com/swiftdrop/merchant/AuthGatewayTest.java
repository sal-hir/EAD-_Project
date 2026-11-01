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
    @BeforeEach void start()throws Exception{
        auth=HttpServer.create(new InetSocketAddress("localhost",0),0);base="http://localhost:"+auth.getAddress().getPort();
        auth.createContext("/api/v1/auth/",exchange->{
            String authorization=exchange.getRequestHeaders().getFirst("Authorization");
            int code=status.get();if(!"Bearer opaque-verified-by-auth".equals(authorization))code=401;
            boolean grant=exchange.getRequestURI().getPath().contains("internal/");
            if(grant&&!key.equals(exchange.getRequestHeaders().getFirst("X-SwiftDrop-Service-Key")))code=403;
            String payload="{\"success\":true,\"data\":{\"id\":\""+id+"\",\"role\":\"MERCHANT\",\"active\":true}}";
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
}
