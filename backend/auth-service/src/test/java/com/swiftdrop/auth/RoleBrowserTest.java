package com.swiftdrop.auth;

import com.swiftdrop.auth.dto.IdentityDtos.*;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.repository.UserRepository;
import com.swiftdrop.auth.service.IdentityService;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.*;

/** Optional real-browser suite; all privileged fixtures exist only in an isolated H2 database. */
@EnabledIfSystemProperty(named="auth.browser.tests",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.datasource.url=jdbc:h2:mem:rolebrowser;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;INIT=CREATE SCHEMA IF NOT EXISTS auth"})
@ActiveProfiles("test")
class RoleBrowserTest {
    @LocalServerPort int port;
    @Autowired IdentityService identities;
    @Autowired UserRepository users;
    @Test void realBrowserFiveRoleAndAdministrativeFlows()throws Exception{
        Path backend=Path.of("").toAbsolutePath(),workspace=backend.getParent().getParent();
        Path frontend=workspace.resolve("frontend"),log=backend.resolve("target/browser-role-results.log");
        String password="Browser@"+UUID.randomUUID().toString().replace("-","");
        var admin=identities.bootstrap("Browser admin","admin@browser.example",password);
        identities.activate(new ActivationRequest(java.net.URI.create(identities.provision(admin.id(),new ProvisionRequest("Browser customer","customer@browser.example",null,Role.MERCHANT,true)).activationUrl()).getFragment().substring(5),password));
        User customer=users.findByEmail("customer@browser.example").orElseThrow();customer.setRole(Role.CUSTOMER);users.saveAndFlush(customer);
        for(Role role:List.of(Role.MERCHANT,Role.COURIER,Role.DISPATCHER)){
            var activation=identities.provision(admin.id(),new ProvisionRequest("Browser "+role,role.name().toLowerCase()+"@browser.example",null,role,true));
            identities.activate(new ActivationRequest(URI.create(activation.activationUrl()).getFragment().substring(5),password));
        }
        Process vite=null;
        try {
            try(var socket=new Socket()){socket.connect(new InetSocketAddress("localhost",3000),1000);}
            catch(java.io.IOException unavailable){
                vite=new ProcessBuilder("node","node_modules/vite/bin/vite.js","--host","localhost","--port","3000","--strictPort")
                    .directory(frontend.toFile()).redirectErrorStream(true).redirectOutput(backend.resolve("target/browser-vite.log").toFile()).start();
            }
            var command=new ProcessBuilder("node","e2e/auth-roles.cjs").directory(frontend.toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
            command.environment().put("AUTH_BROWSER_API","http://localhost:"+port);
            command.environment().put("AUTH_BROWSER_PASSWORD",password);
            Path playwright=backend.resolve("target/browser-verification/node_modules/playwright");
            if(Files.isDirectory(playwright))command.environment().put("SWIFTDROP_PLAYWRIGHT_PATH",playwright.toString());
            Process browser=command.start();
            try {
                if(!browser.waitFor(180,TimeUnit.SECONDS)){browser.destroyForcibly();throw new AssertionError("Browser suite timed out; see target/browser-role-results.log");}
                assertThat(browser.exitValue()).withFailMessage("Browser checks failed; see target/browser-role-results.log").isZero();
            } finally {browser.destroy();}
        } finally {if(vite!=null){vite.destroy();if(!vite.waitFor(5,TimeUnit.SECONDS))vite.destroyForcibly();}}
    }
}
