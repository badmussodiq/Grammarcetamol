package com.grammarcetamol.enrollment.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // This service's own exchange, for events it publishes.
    public static final String ENROLLMENT_EXCHANGE = "enrollment.exchange";

    // payment-service's exchange — declared here too so this service's own queue/binding to it
    // exists independently of whether payment-service has started yet (idempotent declare).
    public static final String PAYMENT_EXCHANGE = "payment.exchange";
    public static final String PAYMENT_COMPLETED_QUEUE = "enrollment.payment-completed.queue";

    @Bean
    public TopicExchange enrollmentExchange() {
        return new TopicExchange(ENROLLMENT_EXCHANGE);
    }

    @Bean
    public TopicExchange paymentExchange() {
        return new TopicExchange(PAYMENT_EXCHANGE);
    }

    @Bean
    public Queue paymentCompletedQueue() {
        return new Queue(PAYMENT_COMPLETED_QUEUE, true);
    }

    @Bean
    public Binding paymentCompletedBinding(Queue paymentCompletedQueue, TopicExchange paymentExchange) {
        return BindingBuilder.bind(paymentCompletedQueue).to(paymentExchange).with("payment.completed");
    }

    @Bean
    public Jackson2JsonMessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        return template;
    }
}
