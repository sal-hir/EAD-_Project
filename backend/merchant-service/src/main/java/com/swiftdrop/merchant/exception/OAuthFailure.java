package com.swiftdrop.merchant.exception;

/** Protocol errors contain no client identifiers, secrets or tokens. */
public class OAuthFailure extends RuntimeException {
    private final int status;
    private final String error;
    public OAuthFailure(int status, String error) { super(error); this.status=status; this.error=error; }
    public int status() { return status; }
    public String error() { return error; }
}
