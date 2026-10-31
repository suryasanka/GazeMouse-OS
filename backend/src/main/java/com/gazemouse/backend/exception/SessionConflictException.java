package com.gazemouse.backend.exception;

/**
 * Thrown when an idempotency conflict occurs (e.g. duplicate session ID with different payload
 * or session ID belonging to another installation).
 */
public class SessionConflictException extends RuntimeException {

    public SessionConflictException(String message) {
        super(message);
    }
}

