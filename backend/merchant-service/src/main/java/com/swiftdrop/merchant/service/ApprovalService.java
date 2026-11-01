package com.swiftdrop.merchant.service;

import com.swiftdrop.merchant.client.IdentityGateway;
import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.MerchantDtos.*;
import com.swiftdrop.merchant.exception.ApiFailure;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ApprovalService {
    private final ApplicationService applications;private final IdentityGateway identities;
    public ApprovalService(ApplicationService applications,IdentityGateway identities){this.applications=applications;this.identities=identities;}
    public Profile approve(Caller caller,UUID id,long version,String bearer){
        // Commit the decision before remote I/O. No distributed transaction or persisted JWT.
        Profile profile=applications.beginApproval(caller,id,version);
        if(profile.status()==Status.APPROVED)return profile;
        try{identities.grantMerchant(bearer,id,profile.userId());}
        catch(ApiFailure unavailable){return applications.failed(caller,id);}
        // If this commit fails, repeat approval; Auth's application ID is an idempotency key.
        return applications.approved(caller,id);
    }
}
