package com.gazemouse.backend.exception;

/**
 * Thrown when the X-Installation-Id header is missing, blank, or malformed.
 */
public class InvalidInstallationIdException extends RuntimeException {

    public InvalidInstallationIdException(String message) {
        super(message);
    }
}

