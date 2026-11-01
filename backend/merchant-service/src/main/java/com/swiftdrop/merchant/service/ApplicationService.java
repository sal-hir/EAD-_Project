package com.swiftdrop.merchant.service;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.MerchantDtos.*;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApplicationService {
    private final ApplicationRepository applications;private final JdbcTemplate db;
    public ApplicationService(ApplicationRepository applications,JdbcTemplate db){this.applications=applications;this.db=db;}
    static void admin(Caller caller){if(!"ADMIN".equals(caller.role()))throw new ApiFailure(403,"Administrator access required");}
    static void applicant(Caller caller){if(!Set.of("CUSTOMER","MERCHANT").contains(caller.role()))throw new ApiFailure(403,"Customer or merchant identity required");}
    private static ApiFailure missing(){return new ApiFailure(404,"Application unavailable");}
    private static ApiFailure conflict(){return new ApiFailure(409,"Application state changed; reload and retry");}
    private void version(Application a,long expected){if(a.getVersion()!=expected)throw conflict();}
    private void audit(UUID id,Caller caller,String action,String detail){db.update("insert into merchant.approval_audit(id,application_id,actor_id,action,detail,created_at) values(?,?,?,?,?,?)",UUID.randomUUID(),id,caller.id(),action,detail,Timestamp.from(Instant.now()));}
    private Profile save(Application a){return applications.saveAndFlush(a).profile();}
    @Transactional public Profile submit(Caller caller,Business business){
        applicant(caller);if(applications.findByUserId(caller.id()).isPresent())throw new ApiFailure(409,"An application already exists; view or update it");
        var a=applications.saveAndFlush(new Application(caller.id(),business));audit(a.getId(),caller,"SUBMITTED","Awaiting administrator review");return a.profile();
    }
    @Transactional(readOnly=true) public Profile own(Caller caller){applicant(caller);return applications.findByUserId(caller.id()).orElseThrow(ApplicationService::missing).profile();}
    @Transactional public Profile edit(Caller caller,Update request){
        applicant(caller);var a=applications.lockByOwner(caller.id()).orElseThrow(ApplicationService::missing);
        if(!Set.of(Status.PENDING,Status.REJECTED).contains(a.getStatus()))throw conflict();version(a,request.version());
        a.edit(request.business());audit(a.getId(),caller,"DETAILS_UPDATED","Business information corrected");return save(a);
    }
    @Transactional public Profile resubmit(Caller caller,long expected){
        applicant(caller);var a=applications.lockByOwner(caller.id()).orElseThrow(ApplicationService::missing);
        if(a.getStatus()!=Status.REJECTED)throw conflict();version(a,expected);a.resubmit();audit(a.getId(),caller,"RESUBMITTED","Awaiting fresh review");return save(a);
    }
    @Transactional(readOnly=true) public PageResult list(Caller caller,Status status,String search,int page){
        admin(caller);if(page<0||search.length()>120)throw new ApiFailure(400,"Invalid page or search");
        var result=applications.search(status,search.strip(),PageRequest.of(page,20,Sort.by("submittedAt").ascending().and(Sort.by("id"))));
        return new PageResult(result.map(Application::profile).getContent(),page,result.getTotalPages(),result.getTotalElements());
    }
    @Transactional(readOnly=true) public Profile get(Caller caller,UUID id){admin(caller);return applications.findById(id).orElseThrow(ApplicationService::missing).profile();}
    @Transactional public Profile beginApproval(Caller caller,UUID id,long expected){
        admin(caller);var a=applications.lockById(id).orElseThrow(ApplicationService::missing);
        if(a.getUserId().equals(caller.id()))throw new ApiFailure(403,"Applicants cannot approve themselves");
        if(a.getStatus()==Status.APPROVED)return a.profile();
        if(a.getStatus()==Status.APPROVING){audit(id,caller,"SYNC_RETRY","Administrator requested reconciliation");return a.profile();}
        if(a.getStatus()!=Status.PENDING)throw conflict();version(a,expected);
        a.approving(caller.id());audit(id,caller,"APPROVAL_DECIDED","Role synchronization pending");return save(a);
    }
    @Transactional public Profile approved(Caller caller,UUID id){
        admin(caller);var a=applications.lockById(id).orElseThrow(ApplicationService::missing);
        if(a.getStatus()==Status.APPROVED)return a.profile();if(a.getStatus()!=Status.APPROVING)throw conflict();
        a.approved();audit(id,caller,"APPROVED","Auth Service confirmed merchant identity");return save(a);
    }
    @Transactional public Profile failed(Caller caller,UUID id){
        admin(caller);var a=applications.lockById(id).orElseThrow(ApplicationService::missing);
        if(a.getStatus()==Status.APPROVING){a.syncFailed();audit(id,caller,"SYNC_PENDING","Auth synchronization unavailable; safe retry required");return save(a);}return a.profile();
    }
    @Transactional public Profile reject(Caller caller,UUID id,Rejection request){
        admin(caller);var a=applications.lockById(id).orElseThrow(ApplicationService::missing);
        if(a.getUserId().equals(caller.id()))throw new ApiFailure(403,"Applicants cannot review themselves");
        if(a.getStatus()==Status.REJECTED&&a.getRejectionReason().equals(request.reason().strip()))return a.profile();
        if(a.getStatus()!=Status.PENDING)throw conflict();version(a,request.version());
        a.rejected(caller.id(),request.reason().strip());audit(id,caller,"REJECTED",request.reason().strip());return save(a);
    }
    @Transactional(readOnly=true) public List<Audit> history(Caller caller,UUID id){
        admin(caller);if(!applications.existsById(id))throw missing();
        return db.query("select id,application_id,actor_id,action,detail,created_at from merchant.approval_audit where application_id=? order by created_at desc limit 100",
            (r,n)->new Audit(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getObject(3,UUID.class),r.getString(4),r.getString(5),r.getTimestamp(6).toInstant()),id);
    }
    @Transactional(readOnly=true) public Profile business(Caller caller){
        if(!"MERCHANT".equals(caller.role()))throw new ApiFailure(403,"Approved merchant identity required");
        var a=applications.findByUserId(caller.id()).orElseThrow(ApplicationService::missing);
        if(a.getStatus()!=Status.APPROVED)throw new ApiFailure(403,"Merchant business approval required");return a.profile();
    }
}
