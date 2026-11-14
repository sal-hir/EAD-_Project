package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.dto.OAuthDtos.Identity;
import com.swiftdrop.merchant.dto.MerchantDtos.Envelope;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.service.OAuthClientService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/merchant-api/oauth")
public class OAuthMachineController {
    private void require(Identity identity,String scope,HttpServletResponse response) {
        if (!OAuthClientService.SUPPORTED_SCOPES.contains(scope)) throw new ApiFailure(400,"Unsupported OAuth scope");
        if (!identity.scopes().contains(scope)) {
            response.setHeader("WWW-Authenticate","Bearer error=\"insufficient_scope\", scope=\""+scope+"\"");
            throw new ApiFailure(403,"Insufficient OAuth scope");
        }
    }
    @GetMapping("/identity") public ResponseEntity<Envelope<Identity>> identity(@AuthenticationPrincipal Identity identity,HttpServletResponse response) {
        require(identity,"merchant:read",response); return ApplicationController.safe(identity);
    }
    @GetMapping("/authorize") public ResponseEntity<Envelope<Identity>> authorize(@AuthenticationPrincipal Identity identity,
            @RequestParam(defaultValue="") String scope,HttpServletResponse response) {
        require(identity,scope,response); return ApplicationController.safe(identity);
    }
}
