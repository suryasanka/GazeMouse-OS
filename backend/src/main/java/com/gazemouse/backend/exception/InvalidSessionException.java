package com.gazemouse.backend.exception;

/**
 * Thrown when game session payload violates business rules, game mode constraints,
 * timestamp consistency, or metric segregation.
 */
public class InvalidSessionException extends RuntimeException {

    public InvalidSessionException(String message) {
        super(message);
    }
}

