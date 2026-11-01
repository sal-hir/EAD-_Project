package com.swiftdrop.auth;

import com.swiftdrop.auth.dto.IdentityDtos.*;
import com.swiftdrop.auth.entity.Role;
import com.swiftdrop.auth.service.*;
import java.io.File;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.*;

/** Real Auth + Merchant HTTP servers, isolated H2 databases and a private fake mail inbox. */
@EnabledIfSystemProperty(named="onboarding.browser.tests",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.datasource.url=jdbc:h2:mem:onboardingauth;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;INIT=CREATE SCHEMA IF NOT EXISTS auth",
    "app.merchant-service-token=test-only-onboarding-service-key-never-deploy"})
@ActiveProfiles("test") @Import(OnboardingBrowserTest.MailConfig.class)
class OnboardingBrowserTest {
    @TestConfiguration static class MailConfig {
        @Bean @Primary RecoveryMailer inbox(){return (email,url)->{try{Files.writeString(Path.of("target/onboarding-inbox.link"),url);}catch(java.io.IOException e){throw new IllegalStateException("Private test inbox unavailable");}};}
    }
    @LocalServerPort int port;@Autowired IdentityService identities;
    @Test void completeRecoveryAndMerchantApprovalThroughReact()throws Exception{
        Path backend=Path.of("").toAbsolutePath(),root=backend.getParent().getParent(),merchant=root.resolve("backend/merchant-service"),frontend=root.resolve("frontend");
        Path classpath=merchant.resolve("target/test-runtime-classpath.txt");
        assertThat(Files.exists(classpath)).withFailMessage("Build Merchant tests and dependency:build-classpath first; see README").isTrue();
        String password="Browser@"+UUID.randomUUID().toString().replace("-","");
        var admin=identities.bootstrap("Onboarding admin","admin@onboarding.example",password);
        var provisioned=identities.provision(admin.id(),new ProvisionRequest("Existing merchant","merchant@onboarding.example",null,Role.MERCHANT,true));
        identities.activate(new ActivationRequest(URI.create(provisioned.activationUrl()).getFragment().substring(5),password));
        int merchantPort;try(var socket=new ServerSocket(0)){merchantPort=socket.getLocalPort();}
        String db="jdbc:h2:mem:onboardingmerchant;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;INIT=CREATE SCHEMA IF NOT EXISTS merchant";
        String cp=merchant.resolve("target/classes")+File.pathSeparator+merchant.resolve("target/test-classes")+File.pathSeparator+Files.readString(classpath).strip();
        String java=Path.of(System.getProperty("java.home"),"bin",System.getProperty("os.name").startsWith("Windows")?"java.exe":"java").toString();
        Process service=new ProcessBuilder(java,"-Xms16m","-Xmx144m","-XX:MaxMetaspaceSize=112m","-XX:ReservedCodeCacheSize=24m","-XX:+UseSerialGC","-XX:ActiveProcessorCount=2","-XX:TieredStopAtLevel=1","-cp",cp,
            "com.swiftdrop.merchant.MerchantApplication","--server.port="+merchantPort,"--spring.profiles.active=test","--spring.datasource.url="+db,"--spring.flyway.url="+db,
            "--spring.datasource.username=sa","--spring.datasource.password=","--spring.datasource.driver-class-name=org.h2.Driver","--app.auth-url=http://localhost:"+port,
            "--app.service-token=test-only-onboarding-service-key-never-deploy","--logging.level.org.springframework=WARN","--logging.level.org.hibernate=WARN")
            .directory(merchant.toFile()).redirectErrorStream(true).redirectOutput(backend.resolve("target/onboarding-merchant.log").toFile()).start();
        Process vite=null;Path inbox=backend.resolve("target/onboarding-inbox.link");Files.deleteIfExists(inbox);
        try{
            try(var socket=new Socket()){socket.connect(new InetSocketAddress("localhost",3000),1000);}
            catch(java.io.IOException missing){vite=new ProcessBuilder("node","node_modules/vite/bin/vite.js","--host","localhost","--port","3000","--strictPort").directory(frontend.toFile()).redirectErrorStream(true).redirectOutput(backend.resolve("target/onboarding-vite.log").toFile()).start();}
            var command=new ProcessBuilder("node","e2e/onboarding.cjs").directory(frontend.toFile()).redirectErrorStream(true).redirectOutput(backend.resolve("target/onboarding-browser.log").toFile());
            command.environment().put("AUTH_BROWSER_API","http://localhost:"+port);command.environment().put("MERCHANT_BROWSER_API","http://localhost:"+merchantPort);
            command.environment().put("AUTH_BROWSER_PASSWORD",password);command.environment().put("RECOVERY_INBOX_FILE",inbox.toString());
            Path playwright=backend.resolve("target/browser-verification/node_modules/playwright");if(Files.isDirectory(playwright))command.environment().put("SWIFTDROP_PLAYWRIGHT_PATH",playwright.toString());
            Process browser=command.start();
            try{if(!browser.waitFor(300,TimeUnit.SECONDS)){browser.destroyForcibly();throw new AssertionError("Onboarding browser timed out; see target/onboarding-browser.log");}assertThat(browser.exitValue()).withFailMessage("See target/onboarding-browser.log for failed scenario").isZero();}
            finally{browser.destroy();}
        }finally{service.destroy();if(!service.waitFor(5,TimeUnit.SECONDS))service.destroyForcibly();if(vite!=null){vite.destroy();if(!vite.waitFor(5,TimeUnit.SECONDS))vite.destroyForcibly();}Files.deleteIfExists(inbox);}
    }
}
