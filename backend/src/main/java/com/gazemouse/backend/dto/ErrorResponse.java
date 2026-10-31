package com.gazemouse.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

/**
 * Standard RFC 7807 Problem Details error response representation.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    String type,
    String title,
    int status,
    String detail,
    String instance,
    Instant timestamp,
    Map<String, String> errors
) {
    public static ErrorResponse of(String type, String title, int status, String detail, String instance) {
        return new ErrorResponse(type, title, status, detail, instance, Instant.now(), null);
    }

    public static ErrorResponse ofValidation(String title, int status, String detail, String instance, Map<String, String> errors) {
        return new ErrorResponse("urn:gazemouse:error:validation", title, status, detail, instance, Instant.now(), errors);
    }
}

