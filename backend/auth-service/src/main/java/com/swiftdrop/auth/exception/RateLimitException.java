package com.swiftdrop.auth.exception;

/**
 * Thrown when a client exceeds the allowed request rate.
 * Handled by {@link ApiErrors} to produce a 429 Too Many Requests response
 * with a {@code Retry-After} header.
 */
public class RateLimitException extends RuntimeException {
    private final int retryAfterSeconds;

    public RateLimitException(String message, int retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public int getRetryAfterSeconds() { return retryAfterSeconds; }
}
