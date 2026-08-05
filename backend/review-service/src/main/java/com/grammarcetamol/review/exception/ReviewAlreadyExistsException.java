package com.grammarcetamol.review.exception;

public class ReviewAlreadyExistsException extends RuntimeException {
    public ReviewAlreadyExistsException(String message) {
        super(message);
    }
}
