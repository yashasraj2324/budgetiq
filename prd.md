# PRD - Finance Budget Reallocation Intelligence SaaS

**Event:** Build Bengaluru 2026
**Track:** Finance
**Product Type:** B2B SaaS for Finance / FP&A
**AI:** Qwen
**Workflow:** EnterPro
**Hackathon MVP:** 8 hours

---

## 1. Product Vision

### One-line pitch

> **Turn financial signals into explainable, approved budget reallocation decisions.**

Finance platforms already help companies plan budgets, forecast performance and analyze variances.

Our product focuses on the next decision:

> **"Given what is happening now, where should existing budget move?"**

The system detects unusual spending patterns, evaluates budget against business priority and realized performance, calculates a financially permissible reallocation, uses Qwen to explain the reasoning, and routes the proposal to a human for approval.

### Product principle

**Detect  Calculate  Explain  Approve**

AI assists the decision; it does not control the money.

---

# 2. Problem

Finance teams face three related problems:

### 2.1 Budget becomes stale

Budgets are often established at the beginning of a quarter or year. Business priorities and actual performance can change significantly during that period.

### 2.2 End-of-period spending can become distorted

A department may accelerate spending near the end of a budget cycle because unused budget may be perceived as a loss.

The finance team needs to distinguish:

* planned spending acceleration
* legitimate business activity
* unusual spending patterns requiring review

An anomaly is therefore a **review signal**, not proof of waste.

### 2.3 Identifying a problem is easier than deciding what to do

A dashboard may show:

> Marketing spending increased 3.2x.

But the finance manager still has to determine:

* Should the budget be moved?
* How much can safely be moved?
* Where should it go?
* Which initiative deserves the money?
* What happens if nothing changes?
* Can the decision be audited?

Our product addresses this final decision layer.

---

# 3. Target Customers

## Primary

Mid-size and growing companies with dedicated Finance / FP&A teams.

## Primary users

* FP&A Lead
* Finance Manager
* CFO

## Secondary users

* Department heads
* Budget owners
* Finance controllers

---

# 4. Product Positioning

We are **not another ERP or complete FP&A suite**.

Existing platforms can provide capabilities such as:

* budgeting
* forecasting
* reporting
* variance analysis
* scenario planning
* financial consolidation
* workforce planning

Our product is a focused decision layer that consumes financial information and answers:

> **"What budget should move right now, why, and who should approve it?"**

### Positioning

**Traditional FP&A**

> Plan  Forecast  Analyze  Report

**Our product**

> Detect  Calculate  Explain  Reallocate  Approve

---

# 5. Core Use Case

### Example scenario

It is **Week 11 of a 13-week quarter**.

Marketing:

**Regional Events**

* Allocated: ?10L
* Remaining: ?2.6L
* Priority: 35/100
* Performance: 42/100
* Recent spend velocity: 3.2x baseline

Product:

**Customer Onboarding Automation**

* Priority: 92/100
* Performance: 91/100
* Funding gap: ?5.4L

The system identifies the unusual spending pattern and evaluates whether the remaining Marketing budget could be better aligned elsewhere.

It calculates:

> **Reallocate ?4.8L from Marketing - Regional Events  Product - Customer Onboarding Automation.**

Qwen then explains the recommendation using the structured evidence.

The finance manager can:

**Approve / Modify / Reject**

The decision is recorded in the audit trail.

---

# 6. Core Product Features

## F1 - Financial Data Integration Layer

The platform receives structured financial information from external systems.

### Hackathon

Use:

* synthetic JSON
* CSV
* seeded database

### SaaS roadmap

Integrate with:

* ERP / accounting systems
* existing FP&A platforms
* HR / workforce systems
* data warehouses
* APIs
* CSV uploads

The integration layer normalizes incoming information into a common financial model.

---

## F2 - Spend Pattern Intelligence

Detect unusual spending behavior based on:

* historical spend velocity
* current period progress
* remaining budget
* remaining period
* historical baseline
* planned spend

Example:

> **3.2x normal spending velocity during final 15% of budget period.**

The system classifies this as a **review signal** rather than automatically labeling it waste.

---

## F3 - Priority & Performance Intelligence

Each budget line is evaluated against:

* business priority
* allocated budget
* realized performance
* historical performance
* current funding requirement

Example:

```text
Regional Events
Priority:     35
Performance:  42
Remaining: ?2.6L

Customer Onboarding
Priority:     92
Performance:  91
Funding Gap: ?5.4L
```

This creates the evidence required to justify moving money.

---

# 7. F4 - Deterministic Reallocation Engine

This is the financial decision engine.

The system determines how much money can actually be moved.

### Source surplus

```text
Source Surplus =
Remaining Budget
- Forecasted Necessary Spend
- Safety Reserve
```

### Target gap

```text
Target Gap =
Required Funding
- Current Available Funding
```

### Recommended transfer

```text
Transfer =
MIN(
    Source Surplus,
    Target Gap,
    Policy Maximum
)
```

The amount is calculated by backend rules.

### Critical AI guardrail

**Qwen does not decide the financial amount.**

Qwen receives the calculated financial constraints and explains the resulting recommendation.

This prevents an LLM from inventing a monetary value.

---

# 8. F5 - Qwen Reasoning Layer

Qwen operates on structured financial evidence.

### Input

```json
{

10
Dashboard reflects new allocation
```

---

# 21. Competitive Positioning

We do **not** claim that existing FP&A platforms lack AI.

Instead:

| Category                          | Broad FP&A Platforms           | Our Product     |
| --------------------------------- | ------------------------------ | --------------- |
| Planning                          | Core                           | Not core        |
| Forecasting                       | Core                           | Not core        |
| Reporting                         | Core                           | Supporting      |
| Consolidation                     | Some platforms                 | Not core        |
| Headcount planning                | Common                         | Not core        |
| Scenario planning                 | Common                         | Supporting      |
| Financial analysis                | Core                           | Supporting      |
| Budget anomaly detection          | Yes                            | **Focused**     |
| Priority vs performance           | Possible                       | **Core**        |
| Specific reallocation calculation | Supporting capability / varies | **Core**        |
| Evidence trace for reallocation   | Varies                         | **Core**        |
| Approval workflow                 | Varies                         | **Core**        |
| Decision layer                    | Broad                          | **Specialized** |

### Our differentiation

> **We don't compete with the entire FP&A stack. We specialize in the moment after analysis: deciding whether budget should move, calculating the permissible move, explaining it, and getting it approved.**

---

# 22. Business Value

The product aims to help finance teams:

* identify budget misalignment earlier
* reduce end-of-period budget distortion
* redirect resources toward higher-performing initiatives
* reduce manual budget-review work
* make financial decisions more explainable
* maintain an approval and audit trail

The product does **not** promise that every anomaly represents waste or that every recommendation will produce savings.

It provides a structured decision-support mechanism.

---

# 23. Scalability

The architecture can evolve from:

```text
One company
One quarter
Structured data
```

to:

```text
Multiple companies
Multiple departments
Multiple currencies
Multiple periods
ERP integrations
FP&A integrations
Real-time financial data
Policy-based approvals
```

The core intelligence remains:

> **Financial signal  constrained recommendation  explainability  human approval**

---

# 24. Future Roadmap

### Phase 1 - Hackathon

**Detect  Calculate  Explain  Approve**

### Phase 2 - MVP

* CSV/API ingestion
* user accounts
* policies
* recommendation history
* notification system
* richer analytics

### Phase 3 - SaaS

* ERP integrations
* accounting integrations
* FP&A integrations
* HR integrations
* automated data synchronization
* organization-level policies
* role-based approval workflows

### Phase 4 - Intelligence Platform

* continuous budget monitoring
* cross-department allocation optimization
* scenario simulation
* rolling reallocation recommendations
* portfolio-level resource allocation

---

# 25. Final Product Statement

> **Finance teams already have systems that tell them what happened. We help them decide what to do next.**

Our platform connects to financial data, detects meaningful budget misalignment, calculates a financially constrained reallocation, uses Qwen to explain the evidence, and routes the decision to the appropriate human approver.

### The core philosophy

**AI doesn't move the money.**

**AI makes the financial decision understandable.**

**The deterministic engine protects the numbers.**

**The human owns the decision.**
  "source": "...",
  "target": "...",
  "anomaly": {},
  "priority": {},
  "performance": {},
  "funding_gap": {},
  "reallocation_limit": {}
}
```

### Output

Structured JSON:

```json
{
  "recommendation": "...",
  "source_line": "...",
  "target_line": "...",
  "amount": 480000,
  "reasoning_steps": [],
  "confidence": 0.94
}

09
EnterPro records approval
        ```

The backend validates the response against deterministic calculations.

### Core principle

> **The engine calculates. Qwen explains. The human decides.**

---

# 9. F6 - Explainability Trace

Every recommendation contains an expandable evidence trace.

### Step 1 - What was detected?

> Spending accelerated 3.2x during the final two weeks.

### Step 2 - What was compared?

> Regional Events vs. Customer Onboarding Automation.

### Step 3 - Why the source?

08
Approve
        
> Priority: 35/100
> Performance: 42/100

### Step 4 - Why the target?

> Priority: 92/100
> Performance: 91/100
> Funding gap: ?5.4L

### Step 5 - Why this amount?

Show the deterministic calculation.

### Step 6 - What happens if rejected?

Show the estimated consequence / remaining funding gap.

---

# 10. F7 - Human Approval Workflow

Recommendations are never automatically applied.

07
Expand reasoning trace
        
Finance users can:

* Approve
* Modify
* Reject

After approval:

1. Budget values are updated.
2. Recommendation status changes.
3. Approver identity is recorded.
4. Timestamp is recorded.
5. Previous and new allocations are preserved.

EnterPro manages the workflow and audit state.

---



Product
Customer Onboarding Automation

06
?4.8L A  B
        
ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ

WHY?

3.2x spend acceleration
Source priority: 35/100
Source performance: 42/100
Target priority: 92/100
Target performance: 91/100
Target funding gap: ?5.4L

[View reasoning]

[Reject] [Modify] [Approve]
```

No generic chat interface is required for the core product.

---

# 13. Optional AI Interaction


05
Generate Recommendation
        A constrained **"Explain this recommendation"** interaction may be added.

It is not a general-purpose financial chatbot.

The AI can answer questions such as:

> "Why was this budget selected for reallocation?"

> "What evidence supports this recommendation?"

> "What happens if I reject it?"

The answers must remain grounded in the recommendation's structured evidence.

---

# 14. Data Model

```text
Company
 ÃÄÄ Department
 ³    ÃÄÄ BudgetLine
 ³    ÃÄÄ SpendEntry

04
System compares priority + performance
         ³    ÀÄÄ PerformanceScore
 ³
 ÀÄÄ Recommendation
```

Reallocation Intelligence
```

### Important principle

We do not replace the customer's ERP or FP&A platform.

We become the **decision layer on top of existing financial infrastructure**.

---

# 18. What We Are NOT Building

To maintain a strong MVP:

### Out of scope

* General ledger

03
Finance manager clicks Review
        * Accounting system
* Full ERP
* Full FP&A replacement
* Multi-year forecasting suite
* Financial close platform
* Generic financial chatbot
* Invoice OCR
* Invoice management
* RAG over arbitrary financial documents
* Real ERP integrations during hackathon
* Multi-tenant enterprise security
* Automatic budget transfers

These can be considered future extensions only where they strengthen the core reallocation workflow.

---

# 19. Hackathon MVP

The complete 8-hour demo should contain only:

### 1. Finance Dashboard


02
System highlights unusual spending
        4-6 departments with realistic financial data.

### 2. Anomaly Detection

One convincing end-of-period spending anomaly.

### 3. Priority/Performance Comparison

One high-performing, underfunded initiative.

### 4. Reallocation Engine

Calculate an exact permissible amount.

### 5. Qwen

Generate structured reasoning.

### 6. Recommendation

```text
?4.8L
A  B
```

### 7. Explainability

Expandable evidence trace.

### 8. Approval

Approve / Modify / Reject.

### 9. Audit

Record the decision.

---

# 20. Demo Flow

```text
01
Dashboard opens
        
### Core entities

```text
Department
- id
- name
- priority_weight

BudgetLine
- id
- department_id
- name
- allocated_amount
- priority_weight
- category

SpendEntry
- id
- budget_line_id
- period
- amount_spent


Unified Finance Data Layer
      PerformanceScore
- id
- budget_line_id
- period
- score
- metric_type

Recommendation
- id
- source_line_id
- target_line_id
- amount
- rationale_json
- status
- timestamp
```

---

# 15. Architecture

```text
       DATA SOURCES

Normalized financial model
```

### Level 3 - Finance ecosystem

```text
ERP
FP&A
HR
Data Warehouse
Accounting
                   ³
    ÚÄÄÄÄÄÄÄÄÅÄÄÄÄÄÄÄÄÄ¿
    ³        ³         ³
   ERP     FP&A       CSV/API
    ³        ³         ³
    ÀÄÄÄÄÄÄÄÄÅÄÄÄÄÄÄÄÄÄÙ
                 DATA INTEGRATION LAYER
             ³
                 NORMALIZED FINANCIAL DATA
             ³
                 ÚÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¿
    ³ FINANCIAL INTELLIGENCE³
    ³                       ³
    ³ Anomaly Detection     ³
    ³ Priority Analysis     ³
    ³ Performance Analysis  ³
    ÀÄÄÄÄÄÄÄÄÄÄÂÄÄÄÄÄÄÄÄÄÄÄÄÙ
                   DETERMINISTIC REALLOCATION
             ENGINE
               ³
                            QWEN
       Reasoning / Explanation
               ³

Connector
                            RECOMMENDATION CARD
               ³
                       HUMAN APPROVAL
               ³
                      ENTERPRO WORKFLOW
               ³
                         AUDIT LOG
```

---

# 16. Technology Stack

### Frontend

* React / Next.js
* Tailwind CSS
* Recharts

### Backend

* **Python**
* FastAPI

Normalized schema
```

### Level 2 - Early SaaS

```text
ERP / Accounting
      * Pydantic

### Intelligence

* Python financial rules
* Statistical spend analysis
* Qwen structured reasoning

### Database

* PostgreSQL

### Workflow

* EnterPro

### Integration

Future:

* REST APIs
* Webhooks
* CSV
* ERP connectors
* FP&A connectors

---

# 17. Integration Strategy

Integrations are part of the **SaaS roadmap**, not the 8-hour MVP.

### Level 1 - MVP

```text
CSV / JSON
   # 11. SaaS Dashboard

The main product should be a **finance cockpit**, not a chatbot.

### Dashboard

```text
Finance Intelligence
ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ

Budget Health       Attention Required
?42.8L              3

Reallocatable       Active Recommendations
?6.2L               2

ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ

Departments

Marketing       ÛÛÛÛÛÛÛÛÛÛÛÛÛÛÛÛ
Product         ÛÛÛÛÛÛÛÛÛÛÛ
Engineering     ÛÛÛÛÛÛÛÛÛÛÛÛÛ
Sales           ÛÛÛÛÛÛÛÛÛÛ

ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ

? Attention Required

Marketing - Regional Events
Unusual spend acceleration: 3.2x

[Review]
```

---

# 12. Recommendation Interface

```text
RECOMMENDATION

Move ?4,80,000

Marketing
Regional Events

             
