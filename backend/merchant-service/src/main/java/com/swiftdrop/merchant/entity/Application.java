package com.swiftdrop.merchant.entity;

import com.swiftdrop.merchant.dto.MerchantDtos.*;
import jakarta.persistence.*;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="applications")
public class Application {
    @Embeddable public static class Details {
        @Column(name="business_name",nullable=false,length=120) String businessName;
        @Column(name="trading_name",length=120) String tradingName;
        @Column(name="registration_number",length=80) String registrationNumber;
        @Column(nullable=false,length=60) String category;
        @Column(name="contact_name",nullable=false,length=120) String contactName;
        @Column(name="business_email",nullable=false,length=254) String businessEmail;
        @Column(nullable=false,length=30) String phone;
        @Column(nullable=false,length=500) String address;
        @Column(nullable=false,length=120) String district;
        @Column(length=300) String website;
        @Column(name="additional_details",length=2000) String additionalDetails;
        protected Details(){}
        Details(Business b){businessName=b.businessName().strip();tradingName=b.tradingName();registrationNumber=b.registrationNumber();category=b.category().strip();contactName=b.contactName().strip();businessEmail=b.businessEmail().strip();phone=b.phone();address=b.address().strip();district=b.district().strip();website=b.website();additionalDetails=b.additionalDetails();}
        Business dto(){return new Business(businessName,tradingName,registrationNumber,category,contactName,businessEmail,phone,address,district,website,additionalDetails);}
    }
    @Id UUID id;
    @Column(name="user_id",nullable=false,unique=true) UUID userId;
    @Embedded Details details;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) Status status;
    @Version long version;
    @Column(nullable=false) Instant submittedAt;
    @Column(nullable=false,updatable=false) Instant createdAt;
    @Column(nullable=false) Instant updatedAt;
    Instant approvedAt;UUID reviewedBy;
    @Column(length=1000) String rejectionReason;
    @Column(length=200) String syncError;
    protected Application(){}
    public Application(UUID owner,Business business){id=UUID.randomUUID();userId=owner;details=new Details(business);status=Status.PENDING;submittedAt=Instant.now();}
    @PrePersist void created(){createdAt=updatedAt=Instant.now();}
    @PreUpdate void updated(){updatedAt=Instant.now();}
    public Profile profile(){return new Profile(id,userId,details.dto(),status,version,submittedAt,createdAt,updatedAt,approvedAt,reviewedBy,rejectionReason,syncError);}
    public UUID getId(){return id;}public UUID getUserId(){return userId;}public Status getStatus(){return status;}public long getVersion(){return version;}
    public String getRejectionReason(){return rejectionReason;}
    public void edit(Business b){details=new Details(b);}
    public void resubmit(){status=Status.PENDING;submittedAt=Instant.now();rejectionReason=null;reviewedBy=null;syncError=null;}
    public void approving(UUID admin){status=Status.APPROVING;reviewedBy=admin;rejectionReason=null;syncError=null;}
    public void approved(){status=Status.APPROVED;approvedAt=Instant.now();syncError=null;}
    public void syncFailed(){syncError="Identity synchronization pending. Administrator: check Auth availability/configuration and retry approval.";}
    public void rejected(UUID admin,String reason){status=Status.REJECTED;reviewedBy=admin;rejectionReason=reason;syncError=null;}
}
