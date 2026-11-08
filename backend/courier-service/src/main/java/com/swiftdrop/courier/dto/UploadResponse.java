package com.swiftdrop.courier.dto;

public record UploadResponse(
    String url,
    String filename,
    long size
) {}

