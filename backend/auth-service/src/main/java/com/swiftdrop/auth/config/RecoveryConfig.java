package com.swiftdrop.auth.config;

import org.springframework.context.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class RecoveryConfig {
    @Bean(name="recoveryExecutor") ThreadPoolTaskExecutor recoveryExecutor(){
        var executor=new ThreadPoolTaskExecutor();executor.setCorePoolSize(2);executor.setMaxPoolSize(2);
        executor.setQueueCapacity(64);executor.setThreadNamePrefix("recovery-");
        executor.setWaitForTasksToCompleteOnShutdown(false);return executor;
    }
}
