package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.MerchantDtos.*;
import com.swiftdrop.merchant.service.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/merchants")
public class ApplicationController {
    private final ApplicationService applications;private final ApprovalService approvals;
    public ApplicationController(ApplicationService applications,ApprovalService approvals){this.applications=applications;this.approvals=approvals;}
    static <T> ResponseEntity<Envelope<T>> safe(T data){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Envelope.ok(data));}
    @PostMapping("/applications") public ResponseEntity<Envelope<Profile>> submit(@AuthenticationPrincipal Caller caller,@Valid @RequestBody Business request){return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(Envelope.ok(applications.submit(caller,request)));}
    @GetMapping("/applications/me") public ResponseEntity<Envelope<Profile>> own(@AuthenticationPrincipal Caller caller){return safe(applications.own(caller));}
    @PutMapping("/applications/me") public ResponseEntity<Envelope<Profile>> edit(@AuthenticationPrincipal Caller caller,@Valid @RequestBody Update request){return safe(applications.edit(caller,request));}
    @PostMapping("/applications/me/resubmit") public ResponseEntity<Envelope<Profile>> resubmit(@AuthenticationPrincipal Caller caller,@Valid @RequestBody Version request){return safe(applications.resubmit(caller,request.version()));}
    @GetMapping("/profile") public ResponseEntity<Envelope<Profile>> business(@AuthenticationPrincipal Caller caller){return safe(applications.business(caller));}
    @GetMapping("/admin/applications") public ResponseEntity<Envelope<PageResult>> list(@AuthenticationPrincipal Caller caller,@RequestParam(required=false) Status status,@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="0") int page){return safe(applications.list(caller,status,search,page));}
    @GetMapping("/admin/applications/{id}") public ResponseEntity<Envelope<Profile>> get(@AuthenticationPrincipal Caller caller,@PathVariable UUID id){return safe(applications.get(caller,id));}
    @GetMapping("/admin/applications/{id}/audit") public ResponseEntity<Envelope<List<Audit>>> audit(@AuthenticationPrincipal Caller caller,@PathVariable UUID id){return safe(applications.history(caller,id));}
    @PostMapping("/admin/applications/{id}/approve") public ResponseEntity<Envelope<Profile>> approve(@AuthenticationPrincipal Caller caller,@PathVariable UUID id,@Valid @RequestBody Version request,@RequestHeader("Authorization") String authorization){
        var result=approvals.approve(caller,id,request.version(),authorization.substring(7));
        return ResponseEntity.status(result.status()==Status.APPROVED?200:202).cacheControl(CacheControl.noStore()).body(Envelope.ok(result));
    }
    @PostMapping("/admin/applications/{id}/reject") public ResponseEntity<Envelope<Profile>> reject(@AuthenticationPrincipal Caller caller,@PathVariable UUID id,@Valid @RequestBody Rejection request){return safe(applications.reject(caller,id,request));}
}
