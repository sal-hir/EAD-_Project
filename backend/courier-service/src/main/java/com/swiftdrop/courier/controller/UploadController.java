package com.swiftdrop.courier.controller;

import com.swiftdrop.courier.dto.UploadResponse;
import com.swiftdrop.courier.service.FileStorageService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class UploadController {
    private final FileStorageService storageService;

    public UploadController(FileStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping(value = {"/uploads/proof", "/couriers/proof"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadProof(@RequestParam("image") MultipartFile image) {
        UploadResponse resp = storageService.store(image);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", resp
        ));
    }
}

