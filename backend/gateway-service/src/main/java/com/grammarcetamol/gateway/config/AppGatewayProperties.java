package com.grammarcetamol.gateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "gateway")
public class AppGatewayProperties {

    private String authServiceUrl;
    private String userServiceUrl;
    private String courseServiceUrl;
    private String internalToken;
}
