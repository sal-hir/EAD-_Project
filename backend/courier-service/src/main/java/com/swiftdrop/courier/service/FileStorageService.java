package com.swiftdrop.courier.service;

import com.swiftdrop.courier.dto.UploadResponse;
import com.swiftdrop.courier.exception.ApiFailure;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {
    private final Path uploadPath;
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/jpg");

    public FileStorageService(@Value("${app.upload-dir:./uploads}") String uploadDir) {
        this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(uploadPath);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize upload directory: " + uploadPath, e);
        }
    }

    public UploadResponse store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiFailure(400, "Image file cannot be empty");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new ApiFailure(400, "Only JPEG, PNG, or WEBP images are allowed");
        }

        String originalName = file.getOriginalFilename();
        String ext = ".jpg";
        if (originalName != null && originalName.lastIndexOf('.') > 0) {
            ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();
            if (!Set.of(".jpg", ".jpeg", ".png", ".webp").contains(ext)) {
                ext = ".jpg";
            }
        }

        String filename = "proof-" + UUID.randomUUID() + ext;
        Path target = uploadPath.resolve(filename);

        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            String url = "/uploads/" + filename;
            return new UploadResponse(url, filename, file.getSize());
        } catch (IOException e) {
            throw new ApiFailure(500, "Failed to save uploaded file: " + e.getMessage());
        }
    }
}

