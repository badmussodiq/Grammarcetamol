package com.grammarcetamol.enrollment.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String courseServiceUrl;
    private String uploadServiceUrl;
    private int atRiskCompletionThresholdPct = 20;
    private int atRiskMinDaysSinceEnrollment = 14;
}
