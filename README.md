# ⚡ SwiftDrop — Parcel Delivery & Courier Management System

> Enterprise Application Development Assignment — Weightage: 20 Marks | 10-Member Team

SwiftDrop is a full-stack, event-driven enterprise courier logistics platform that allows customers and merchants to send and track parcels, dispatchers to balance courier workloads, and couriers to update delivery milestones in real time.

---

## 🌟 Key Features

- **Customer Experience:**
  - Secure registration & login (JWT + Google OAuth 2.0).
  - Dynamic fee estimation based on delivery zones, package weight, and size.
  - Real-time parcel tracking via WebSockets (Socket.io) with instant UI updates.
  - Downloadable official PDF delivery receipts.
  - Public tracking portal accessible via tracking code without authentication.

- **B2B Merchant Platform:**
  - Merchant self-service registration with administrator approval workflow.
  - Programmatic parcel creation using secured API keys (`X-API-Key`).
  - Automated webhook notifications dispatched to merchant endpoints on status changes.
  - Webhook delivery worker featuring **exponential backoff retries** and **HMAC-SHA256 signatures**.

- **Courier Mobile Console:**
  - Daily assigned deliveries view with vehicle specifications.
  - Multi-stage status stepper (Pending Pickup → Picked Up → In Transit → Out for Delivery → Delivered).
  - Proof of delivery photo upload and recipient note recording.
  - Failure logging with pre-categorized reasons.
  - Real-time duty availability toggle.

- **Dispatcher & Administrator Control Center:**
  - Real-time unassigned parcel queue with smart courier assignment.
  - Courier workload monitor tracking active deliveries per courier.
  - Operations KPI dashboard: total volume, success/failure rate, daily trends.
  - Dynamic delivery zone and tariff management.

- **Enterprise Architecture & Messaging:**
  - **Modular Monolith with BFF** architecture backed by PostgreSQL and Prisma ORM.
  - **RabbitMQ Topic Exchange** (`swiftdrop.events`) for asynchronous pub/sub.
  - Dedicated **Notification Service** container handling customer emails (Nodemailer/Ethereal) and merchant webhooks.
  - Comprehensive Docker Compose orchestration for local development and deployment.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, TailwindCSS, Socket.io-client, Lucide Icons |
| **Backend API** | Node.js 20, Express, Socket.io, Passport.js (JWT & Google OAuth), Winston, Multer, PDFKit |
| **Database & ORM** | PostgreSQL 16, Prisma ORM |
| **Message Broker** | RabbitMQ 3.13 (Management Alpine) |
| **Notification Worker** | Node.js, Nodemailer (Ethereal test SMTP / SendGrid), Axios, HMAC-SHA256 |
| **Containerization** | Docker, Docker Compose, Nginx |
| **Testing** | Jest, Supertest |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose installed and running.
- Alternatively for local dev: Node.js 20+, PostgreSQL 16, and RabbitMQ.

### Option 1: One-Click Docker Compose (Recommended)

1. **Clone the repository and enter directory:**
   ```bash
   cd swiftdrop
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start all services in Docker:**
   ```bash
   docker compose up --build
   ```

4. **Access the application:**
   - **Frontend Web App:** [http://localhost:3000](http://localhost:3000)
   - **Backend REST API:** [http://localhost:4000/health](http://localhost:4000/health)
   - **RabbitMQ Management Dashboard:** [http://localhost:15672](http://localhost:15672) (User: `swiftdrop` / Pass: `swiftdrop_mq`)

---

### Option 2: Running Locally Without Docker

#### Step 1: Start PostgreSQL and RabbitMQ
Make sure PostgreSQL is running on port `5432` and RabbitMQ on port `5672`.

#### Step 2: Setup and Run the Backend API
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

#### Step 3: Run the Notification Service
```bash
cd notification-service
npm install
npm run dev
```

#### Step 4: Run the React Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Pre-Seeded Test Credentials

The database seed script automatically creates testing accounts for all system roles with password `Password@123` / `Role@123!`:

| Role | Email | Password | Purpose |
|---|---|---|---|
| **Admin** | `admin@swiftdrop.lk` | `Admin@123!` | Full admin console, reports, merchant approvals |
| **Dispatcher** | `dispatcher@swiftdrop.lk` | `Dispatch@123!` | Assigning couriers, monitoring fleet workloads |
| **Courier 1** | `courier1@swiftdrop.lk` | `Courier@123!` | Daily deliveries (Motorcycle, Colombo Metro) |
| **Courier 2** | `courier2@swiftdrop.lk` | `Courier@123!` | Daily deliveries (Van, Western Province) |
| **Customer** | `customer@example.com` | `Customer@123!` | Booking parcels, viewing history, tracking |
| **Merchant** | `merchant@shopexample.lk` | `Merchant@123!` | B2B API access, merchant dashboard, webhooks |

*Note: The Login screen includes convenient **1-click quick-fill buttons** for all demo roles.*

---

## 🧪 Running Automated Tests & Code Coverage

Backend unit and integration tests are powered by **Jest** and **Supertest**:

```bash
cd backend
npm test
```

### Test Suite Structure
- `__tests__/auth.test.js`: User registration, bcrypt password encryption verification, JWT issuance, and login security.
- `__tests__/authorization.test.js`: Role-based access control tests (e.g., verifying a courier **cannot** access or update another courier's assigned deliveries).
- `__tests__/integration.test.js`: Strategy pattern pricing calculation, end-to-end parcel creation, RabbitMQ event publishing, and public tracking lookup.

---

## 📑 Design Documentation & Diagrams

Complete system diagrams and architectural justifications are available in [DESIGN_DOCUMENTATION.md](./DESIGN_DOCUMENTATION.md):
- **Use Case Diagrams** for all 4 actors.
- **Entity Relationship (ER) Diagram** covering all relational models.
- **Architecture Diagram** detailing Presentation, BFF/Gateway, Business Modules, Broker, and Worker tiers.
- **Sequence Diagrams** for Customer Booking, Merchant B2B API, Courier Status Webhooks, and Google OAuth 2.0.
- **Design Patterns** summary (Strategy, Observer, Repository, Chain of Responsibility, BFF).
- **10-Member Group Contribution Sheet**.

---

## 🛡️ License & Academic Integrity
Developed as part of the Enterprise Application Development curriculum. All code is original and adheres to enterprise software engineering standards.
