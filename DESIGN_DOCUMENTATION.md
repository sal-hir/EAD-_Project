# SwiftDrop — Parcel Delivery & Courier Management System
## Comprehensive System Design & Architecture Specification
**Weightage:** 20 Marks | **Target Group Size:** 10 Members | **Module:** Enterprise Application Development

---

## Table of Contents
1. [Executive Summary & Scenario](#1-executive-summary--scenario)
2. [Actor & Use Case Analysis](#2-actor--use-case-analysis)
3. [Domain Entity Relationship (ER) Model](#3-domain-entity-relationship-er-model)
4. [Architecture Design & Justification (Modular Monolith with BFF)](#4-architecture-design--justification)
5. [Enterprise Integration Architecture](#5-enterprise-integration-architecture)
6. [Key Workflow Sequence & Activity Diagrams](#6-key-workflow-sequence--activity-diagrams)
   - 6.1 Customer Parcel Creation & Pricing Calculation
   - 6.2 Merchant B2B API Order Creation
   - 6.3 Courier Status Update, Event Publishing & Webhook Retries
   - 6.4 Google OAuth 2.0 Social Authentication Flow
7. [Design Patterns & Enterprise Principles Applied](#7-design-patterns--enterprise-principles-applied)
8. [Security & Data Protection Architecture](#8-security--data-protection-architecture)
9. [Verification, Testing & Test Coverage Summary](#9-verification-testing--test-coverage-summary)
10. [Team Responsibilities & Contribution Matrix](#10-team-responsibilities--contribution-matrix)

---

## 1. Executive Summary & Scenario

SwiftDrop operates island-wide courier logistics. Historically reliant on manual phone inquiries and fragmented spreadsheets, the business suffered from:
- Zero customer visibility into package delivery stages.
- No automated pipeline for partner e-commerce merchants to submit bulk orders.
- Dispatch bottleneck and inability to track courier workloads.
- Lack of audit trails for proof of delivery.

The modern SwiftDrop Enterprise Platform eliminates these bottlenecks through an event-driven, containerized architecture that integrates customers, couriers, dispatchers, and merchants into a single unified real-time system.

---

## 2. Actor & Use Case Analysis

The platform serves four primary enterprise actors:

### 2.1 Use Case Diagram (System-Wide)

```mermaid
graph LR
    subgraph Actors
        Customer((Customer))
        Merchant((Merchant))
        Courier((Courier))
        Dispatcher((Dispatcher / Admin))
    end

    subgraph "SwiftDrop System Boundary"
        UC1[Sign up / Login with Google OAuth2]
        UC2[Estimate Dynamic Delivery Fee]
        UC3[Create Delivery Request]
        UC4[Live Track Parcel via WebSocket]
        UC5[Download Delivery PDF Receipt]

        UC6[Register Merchant Profile]
        UC7[B2B API Order Creation with API Key]
        UC8[Configure Webhook & Receive Notifications]
        UC9[Merchant Business Dashboard]

        UC10[View Assigned Daily Deliveries]
        UC11[Update Delivery Progress & Proof Photo]
        UC12[Mark Delivery Failure with Reason]
        UC13[Toggle Driver Duty Availability]

        UC14[Assign Parcels to Available Couriers]
        UC15[Monitor Courier Workload Balancing]
        UC16[Manage Pricing Zones & Rates]
        UC17[Approve Merchant Applications]
        UC18[Operations KPI Analytics & Reports]
    end

    Customer --> UC1
    Customer --> UC2
    Customer --> UC3
    Customer --> UC4
    Customer --> UC5

    Merchant --> UC6
    Merchant --> UC7
    Merchant --> UC8
    Merchant --> UC9

    Courier --> UC10
    Courier --> UC11
    Courier --> UC12
    Courier --> UC13

    Dispatcher --> UC14
    Dispatcher --> UC15
    Dispatcher --> UC16
    Dispatcher --> UC17
    Dispatcher --> UC18
```

---

## 3. Domain Entity Relationship (ER) Model

The relational data model is built in PostgreSQL and mapped using Prisma ORM. It enforces relational integrity, audit trails, and strict foreign-key constraints.

```mermaid
erDiagram
    User ||--o{ Parcel : "books as customer"
    User ||--o| Merchant : "owns business profile"
    User ||--o| Courier : "operates as courier"
    User ||--o{ ParcelStatusHistory : "records status update"

    Merchant ||--o{ Parcel : "originates B2B order"
    Merchant ||--o{ WebhookDelivery : "receives webhook"

    Courier ||--o{ CourierAssignment : "is assigned to"
    Courier ||--o{ Parcel : "delivers"

    Zone ||--o{ Parcel : "rates delivery zone"

    Parcel ||--o{ ParcelStatusHistory : "maintains lifecycle audit"
    Parcel ||--o| CourierAssignment : "has current assignment"
    Parcel ||--o{ WebhookDelivery : "triggers webhook attempt"

    User {
        uuid id PK
        string email UK
        string passwordHash
        string name
        string phone
        string role "CUSTOMER | MERCHANT | COURIER | DISPATCHER | ADMIN"
        string googleId UK
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Merchant {
        uuid id PK
        uuid userId FK
        string businessName
        string businessEmail UK
        string apiKey UK
        string apiKeyHash
        string webhookUrl
        string webhookSecret
        boolean isApproved
        datetime createdAt
    }

    Courier {
        uuid id PK
        uuid userId FK
        string vehicleType
        string licenseNo
        boolean isAvailable
        string zone
        datetime createdAt
    }

    Zone {
        uuid id PK
        string name UK
        float baseFee
        float feePerKg
        int estimatedDays
        boolean isActive
    }

    Parcel {
        uuid id PK
        string trackingNumber UK
        uuid customerId FK
        uuid merchantId FK
        uuid courierId FK
        uuid zoneId FK
        string pickupAddress
        string pickupCity
        string dropoffAddress
        string dropoffCity
        string recipientName
        string recipientPhone
        string recipientEmail
        float weightKg
        string size "SMALL | MEDIUM | LARGE"
        float estimatedFee
        string status "CREATED | PENDING_PICKUP | PICKED_UP | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | FAILED | CANCELLED"
        datetime deliveredAt
        datetime createdAt
    }

    ParcelStatusHistory {
        uuid id PK
        uuid parcelId FK
        string status
        string note
        string proofImageUrl
        string failureReason
        uuid updatedBy FK
        datetime timestamp
    }

    CourierAssignment {
        uuid id PK
        uuid courierId FK
        uuid parcelId FK
        datetime assignedAt
        datetime completedAt
        string assignedBy
    }

    WebhookDelivery {
        uuid id PK
        uuid parcelId FK
        uuid merchantId FK
        string event
        json payload
        string status "PENDING | SUCCESS | FAILED"
        int attempts
        datetime nextRetry
    }
```

---

## 4. Architecture Design & Justification

### 4.1 Architectural Pattern: Modular Monolith with Backend-for-Frontend (BFF)

We selected a **Modular Monolith backed by a BFF Layer and Asynchronous Background Worker Services**:

```mermaid
flowchart TD
    subgraph Presentation_Layer ["Presentation Layer (Client Tier)"]
        ReactApp["React 18 + Vite SPA<br/>(TailwindCSS + Lucide Icons)"]
        MerchantExt["Partner Online Store<br/>(B2B Merchant System)"]
        PublicBrowser["Mobile Tracking Browser<br/>(Public User)"]
    end

    subgraph Gateway_BFF ["BFF & API Gateway Layer"]
        ReverseProxy["Nginx / Express Gateway<br/>CORS, Helmet, Rate Limiter"]
    end

    subgraph Business_Layer ["Core Business Application (Modular Monolith)"]
        AuthModule["Auth Module<br/>(JWT + Google OAuth 2.0)"]
        ParcelModule["Parcels & Pricing Module<br/>(Strategy Calculation)"]
        CourierModule["Courier & Dispatch Module<br/>(Workload Balancer)"]
        MerchantModule["Merchant Module<br/>(API Key Verification)"]
        SocketServer["Socket.io Server<br/>(Real-Time Rooms)"]
    end

    subgraph Integration_Broker ["Message Broker & Pub/Sub Layer"]
        RabbitMQ["RabbitMQ Broker<br/>Topic Exchange: swiftdrop.events"]
        EmailQ["Queue: notifications.email"]
        WebhookQ["Queue: notifications.webhook"]
    end

    subgraph Worker_Tier ["Asynchronous Worker Tier"]
        NotifService["Notification Service Container<br/>(Nodemailer / Ethereal SMTP)"]
        WebhookWorker["Webhook Dispatcher<br/>(HMAC Signing + Exponential Backoff)"]
    end

    subgraph Data_Tier ["Data Persistence Layer"]
        PostgresDB[(PostgreSQL 16 Engine<br/>Prisma ORM)]
        FileStore[("Uploads Volume<br/>Proof of Delivery Photos")]
    end

    ReactApp -->|HTTP REST + JWT| ReverseProxy
    PublicBrowser -->|HTTP REST + WebSocket| ReverseProxy
    MerchantExt -->|HTTP POST with X-API-Key| ReverseProxy

    ReverseProxy --> AuthModule
    ReverseProxy --> ParcelModule
    ReverseProxy --> CourierModule
    ReverseProxy --> MerchantModule
    ReverseProxy --> SocketServer

    AuthModule --> PostgresDB
    ParcelModule --> PostgresDB
    CourierModule --> PostgresDB
    MerchantModule --> PostgresDB

    ParcelModule -->|Publishes Events| RabbitMQ
    CourierModule -->|Publishes Events| RabbitMQ
    CourierModule --> FileStore

    RabbitMQ --> EmailQ
    RabbitMQ --> WebhookQ

    EmailQ --> NotifService
    WebhookQ --> WebhookWorker

    WebhookWorker -->|Signed HTTP POST with Retry| MerchantExt
    SocketServer -.->|Live Status Broadcast| ReactApp
    SocketServer -.->|Live Status Broadcast| PublicBrowser
```

### 4.2 Architecture Justification
1. **Manageability for 10-Member Team:** Full microservices introduce severe overhead (service discovery, distributed transactions, network latency, multiple pipelines). A Modular Monolith keeps domain boundaries clean within separate folders (`modules/auth`, `modules/parcels`, `modules/couriers`, `modules/merchants`), while running in a shared runtime.
2. **True Event-Driven Decoupling:** Long-running external tasks (sending customer emails, executing HTTP webhooks with retries) are offloaded to a dedicated **Notification Consumer container** over RabbitMQ. The main API responds in milliseconds without blocking on third-party networks.
3. **BFF (Backend-For-Frontend) Adaptability:** Aggregates delivery timelines, courier workloads, and live tracking channels specifically formatted for the React UI.

---

## 5. Enterprise Integration Architecture

### 5.1 Integration Patterns Matrix

| Integration Flow | Pattern Used | Technology | Justification |
|---|---|---|---|
| **Client UI ↔ Backend API** | Request-Reply (Synchronous) | REST over HTTPS / JSON | Immediate feedback required for forms, logins, fee calculation. |
| **Status Update ↔ Notification Consumer** | Publish-Subscribe (Asynchronous) | RabbitMQ Topic Exchange (`swiftdrop.events`) | Prevents transaction rollback if email provider fails; durable queue prevents loss during service restarts. |
| **Backend ↔ Live Tracking Screen** | Observer / Push (Bidirectional) | WebSockets via Socket.io | Push updates instantly without polling overhead or stale cache issues. |
| **Backend ↔ Partner Merchant Platform** | Webhook with Exponential Backoff | HTTP POST with HMAC SHA-256 signature | Enterprise standard for B2B notification; exponential retry handles merchant downtime safely. |
| **Social Login ↔ Identity Provider** | Delegated Authorization | OAuth 2.0 (Google Identity) | Safe social signup without handling third-party passwords. |

---

## 6. Key Workflow Sequence & Activity Diagrams

### 6.1 Customer Parcel Creation & Pricing Calculation

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant Frontend as React Frontend
    participant API as SwiftDrop API
    participant Strategy as Pricing Strategy
    participant DB as PostgreSQL (Prisma)
    participant Broker as RabbitMQ Broker

    Customer->>Frontend: Selects Zone, Weight (kg), and Size
    Frontend->>API: GET /api/v1/parcels/estimate?zoneId=...&weightKg=...&size=...
    API->>Strategy: calculateFee(zone, weight, sizeMultiplier)
    Strategy-->>API: Returns fee (LKR)
    API-->>Frontend: Display Live Estimated Fee
    Customer->>Frontend: Fills Pickup & Drop-off and clicks "Confirm"
    Frontend->>API: POST /api/v1/parcels (Bearer JWT)
    API->>DB: INSERT into parcels & status_history (Status: CREATED)
    DB-->>API: Parcel Record with Tracking Number (e.g. SD...)
    API->>Broker: publishEvent("parcel.created", payload)
    API-->>Frontend: 201 Created (Tracking Number & Details)
    Frontend-->>Customer: Redirect to Live Tracking Page
```

### 6.2 Merchant B2B API Order Creation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Partner as Merchant E-Commerce Platform
    participant API as SwiftDrop API Gateway
    participant Auth as API Key Middleware
    participant DB as PostgreSQL
    participant Broker as RabbitMQ

    Partner->>API: POST /api/v1/parcels/merchant (Header: X-API-Key)
    API->>Auth: Validate X-API-Key
    Auth->>DB: Query approved merchants by API key
    alt Invalid or Unapproved Key
        DB-->>Auth: Merchant not found / unapproved
        Auth-->>Partner: 401 Unauthorized
    else Valid Key
        Auth-->>API: Attached req.merchant
        API->>DB: Create Parcel with merchantId
        DB-->>API: Saved Parcel
        API->>Broker: Publish "parcel.created"
        API-->>Partner: 201 Created { trackingNumber, status: "CREATED" }
    end
```

### 6.3 Courier Status Update, Event Publishing & Webhook Retries

```mermaid
sequenceDiagram
    autonumber
    actor Courier as Courier
    participant API as SwiftDrop API
    participant DB as PostgreSQL
    participant Socket as Socket.io Server
    participant Broker as RabbitMQ Broker
    participant Worker as Notification Worker
    participant MerchantWeb as Merchant Webhook Endpoint
    actor Customer as Customer

    Courier->>API: PATCH /api/v1/parcels/:id/status { status: "DELIVERED", note }
    API->>DB: Validate courier assignment & update status
    API->>Socket: emit("status:update", { trackingNumber, status: "DELIVERED" })
    Socket-->>Customer: Real-time UI updates to "DELIVERED"
    API->>Broker: publishEvent("parcel.status_changed", payload)
    API-->>Courier: 200 OK (Status Updated)

    Broker->>Worker: Consume message from swiftdrop.notifications.email
    Worker->>Customer: Send HTML Delivery Confirmation Email

    Broker->>Worker: Consume message from swiftdrop.notifications.webhook
    Worker->>MerchantWeb: POST webhook with X-SwiftDrop-Signature (Attempt 1)
    alt Merchant endpoint returns 200 OK
        MerchantWeb-->>Worker: 200 OK
        Worker->>Worker: ACK message
    else Merchant endpoint fails or times out
        MerchantWeb-->>Worker: 503 / Timeout
        Worker->>Worker: Wait 2s (Exponential backoff) -> Retry Attempt 2
    end
```

### 6.4 Google OAuth 2.0 Social Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant Client as React App
    participant Backend as SwiftDrop Backend
    participant Google as Google OAuth 2.0 Server
    participant DB as PostgreSQL

    User->>Client: Clicks "Sign in with Google"
    Client->>Backend: GET /api/v1/auth/google
    Backend->>Google: Redirect to accounts.google.com/o/oauth2/v2/auth
    User->>Google: Authenticates & grants consent
    Google->>Backend: GET /api/v1/auth/google/callback?code=AUTH_CODE
    Backend->>Google: Exchange AUTH_CODE for Access & ID Token
    Google-->>Backend: Returns profile (email, name, googleId)
    Backend->>DB: Upsert User by googleId / email
    DB-->>Backend: User Entity
    Backend->>Backend: Sign JWT with user ID & Role
    Backend->>Client: Redirect to /auth/callback?token=JWT&role=CUSTOMER
    Client->>Client: Store JWT in localStorage & set AuthContext
    Client-->>User: Redirect to Customer Dashboard
```

---

## 7. Design Patterns & Enterprise Principles Applied

| Pattern / Principle | Implementation Location | Engineering Purpose |
|---|---|---|
| **Strategy Pattern** | `parcel.service.js` (`calculateFee`) | Decouples pricing formulas. Zone base rates, per-kg costs, and size multipliers are interchangeable without modifying booking workflows. |
| **Observer Pattern** | RabbitMQ Pub/Sub & Socket.io | Decouples parcel status mutations from email delivery, merchant webhooks, and UI client notifications. |
| **Repository Pattern** | Prisma ORM Models & Service Wrappers | Centralizes data access, query optimization, and schema mapping. |
| **Chain of Responsibility** | Express Middleware Pipeline | Modular security checks: `authenticate` → `authorize(roles)` → `validate(body)` → `controller`. |
| **BFF (Backend for Frontend)** | Express API Endpoints | Serves customer, courier, merchant, and dispatcher needs from dedicated, tailored data contracts. |
| **SOLID Principles** | Modular System Design | - **Single Responsibility:** Auth, Parcels, Couriers, and Webhooks reside in distinct modules.<br/>- **Open/Closed:** New status types or delivery zones can be added without modifying core controllers.<br/>- **Dependency Inversion:** Config and message publishers are injected into services. |
| **DRY Principle** | Shared Error Handlers & DTO Validators | Centralized `AppError`, `validate` middleware, and formatters eliminate duplicated validation logic. |

---

## 8. Security & Data Protection Architecture

1. **Password Security:** Salted hashing with `bcryptjs` (Cost factor = 12). Plaintext passwords never touch logs or databases.
2. **Stateless JWTs:** Signed using HMAC-SHA256 with 7-day expiration. Includes user role for zero-database authorization checks.
3. **No PII in Logs:** Winston logger is configured to strip sensitive credentials and authorization headers.
4. **B2B API Authentication:** Merchants authenticate via cryptographic 32-byte API keys (`sk_...`) hashed before database storage.
5. **Webhook Security:** Every outgoing webhook payload is signed with HMAC-SHA256 (`X-SwiftDrop-Signature`), allowing merchants to cryptographically verify payload integrity.
6. **Network & HTTP Hardening:** Helmet.js security headers, CORS origin whitelisting, and strict rate-limiting on sensitive endpoints (`/auth/*`).

---

## 9. Verification, Testing & Test Coverage Summary

### Test Automation Suite (Jest + Supertest)
The test suite is structured into three dedicated integration suites located in `backend/__tests__`:
1. `auth.test.js`: Validates registration, bcrypt hashing, rejection of duplicate emails, JWT token generation, and rejection of invalid passwords.
2. `authorization.test.js`: Proves that a courier **cannot** view or update another courier's parcel (HTTP 403 Forbidden), verifying that couriers can only manage their own deliveries.
3. `integration.test.js`: Tests the complete end-to-end pricing strategy calculation, parcel creation, event publishing to RabbitMQ, public tracking retrieval, and status changes.

---

## 10. Team Responsibilities & Contribution Matrix (10-Member Group)

| Member Name | Student ID | Assigned Module / Component | Detailed Contributions |
|---|---|---|---|
| **Member 1 (Lead)** | IT22000001 | Architecture & Core Gateway | Modular Monolith architecture, Express setup, Docker orchestration, environment configuration. |
| **Member 2** | IT22000002 | Authentication & OAuth 2.0 | JWT generation/verification, Passport.js Google OAuth 2.0 strategy, user registration. |
| **Member 3** | IT22000003 | Authorization & RBAC | Role guards (Customer, Merchant, Courier, Dispatcher), resource ownership checks. |
| **Member 4** | IT22000004 | Parcels & Pricing Engine | Parcel booking logic, Strategy pattern dynamic fee calculation, receipt PDF generation. |
| **Member 5** | IT22000005 | RabbitMQ & Pub/Sub Pipeline | RabbitMQ topic exchange declaration, event publishers, consumer channels. |
| **Member 6** | IT22000006 | Notification Service & Worker | Background consumer container, Nodemailer HTML templates, Ethereal mock SMTP integration. |
| **Member 7** | IT22000007 | Merchant B2B API & Webhooks | API Key generation and hashing, webhook dispatching with exponential backoff retry. |
| **Member 8** | IT22000008 | Courier Portal & Uploads | Courier daily console, status transition validation, proof of delivery photo uploads. |
| **Member 9** | IT22000009 | Dispatcher & Operations Admin | Courier assignment engine, fleet workload balancing monitor, KPI analytics reports. |
| **Member 10** | IT22000010 | Frontend SPA & WebSockets | React UI development, Socket.io real-time tracking rooms, TailwindCSS styling. |
