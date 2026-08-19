package com.grammarcetamol.gateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "gateway")
public class AppGatewayProperties {

    private String authServiceUrl;
    private String courseServiceUrl;
    private String enrollmentServiceUrl;
    private String paymentServiceUrl;
    private String reviewServiceUrl;
    private String uploadServiceUrl;
    private String notificationServiceUrl;
    private String liveClassServiceUrl;
    private String internalToken;
}
