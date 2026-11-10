package com.swiftdrop.courier.service;

import com.swiftdrop.courier.config.RabbitMqConfig;
import com.swiftdrop.courier.dto.ParcelStatusEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class EventPublisherService {
    private static final Logger log = LoggerFactory.getLogger(EventPublisherService.class);
    private final RabbitTemplate rabbitTemplate;

    public EventPublisherService(@Autowired(required = false) RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishStatusEvent(ParcelStatusEvent event) {
        if (rabbitTemplate == null) {
            log.info("RabbitTemplate is not available. Skipping status event publish for parcel {}", event.trackingNumber());
            return;
        }
        try {
            log.info("Publishing event {} for trackingNumber={} to exchange={}",
                    event.event(), event.trackingNumber(), RabbitMqConfig.EXCHANGE_NAME);
            rabbitTemplate.convertAndSend(
                    RabbitMqConfig.EXCHANGE_NAME,
                    RabbitMqConfig.ROUTING_KEY_STATUS_CHANGED,
                    event
            );
            log.info("Successfully published status event for parcel {}", event.trackingNumber());
        } catch (Exception e) {
            log.error("Failed to publish status event for parcel {}: {}", event.trackingNumber(), e.getMessage());
        }
    }
}


