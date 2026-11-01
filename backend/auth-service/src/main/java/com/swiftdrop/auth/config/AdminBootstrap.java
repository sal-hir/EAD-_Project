package com.swiftdrop.auth.config;

import com.swiftdrop.auth.service.IdentityService;
import java.io.Console;
import java.util.Arrays;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

/** Local console only, opt-in and one-time. Never accepts credentials as CLI arguments. */
@Component @ConditionalOnProperty(name="app.bootstrap.enabled",havingValue="true")
public class AdminBootstrap implements ApplicationRunner {
    private final IdentityService identities;
    private final ConfigurableApplicationContext context;
    public AdminBootstrap(IdentityService identities,ConfigurableApplicationContext context){this.identities=identities;this.context=context;}
    @Override public void run(ApplicationArguments arguments) {
        Console console=System.console();
        if(console==null)throw new IllegalStateException("Bootstrap requires a local interactive console; use java -jar in a terminal");
        String name=console.readLine("Administrator name: ");String email=console.readLine("Administrator email: ");
        char[] password=console.readPassword("Password (8-72 printable ASCII characters): ");
        char[] confirmation=console.readPassword("Confirm password: ");
        try {
            if(password==null||confirmation==null||!Arrays.equals(password,confirmation))throw new IllegalArgumentException("Passwords do not match");
            var user=identities.bootstrap(name,email,new String(password));
            console.printf("Administrator created (%s). Bootstrap service is stopping.%n",user.id());
        } finally {
            if(password!=null)Arrays.fill(password,'\0');if(confirmation!=null)Arrays.fill(confirmation,'\0');context.close();
        }
    }
}
