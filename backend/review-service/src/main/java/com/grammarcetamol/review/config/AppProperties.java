package com.grammarcetamol.review.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String enrollmentServiceUrl;
    private int reviewCompletionThresholdPct = 50;
    private int reviewEditWindowDays = 7;
}
