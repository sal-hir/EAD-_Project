package com.swiftdrop.merchant.service;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.MerchantDtos.Status;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class MerchantAccess {
    private final ApplicationRepository applications;
    public MerchantAccess(ApplicationRepository applications) { this.applications=applications; }
    public UUID business(Caller caller) {
        if(caller==null || !"MERCHANT".equals(caller.role())) throw new ApiFailure(403,"Approved merchant access required");
        var application=applications.findByUserId(caller.id()).orElseThrow(()->new ApiFailure(403,"Approved merchant access required"));
        if(application.getStatus()!=Status.APPROVED) throw new ApiFailure(403,"Approved merchant access required");
        return application.getId();
    }
}
