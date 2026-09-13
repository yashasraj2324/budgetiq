# Market Requirements Document (MRD)

## Finance Budget Reallocation Intelligence SaaS

**Product Category:** Finance / FP&A Decision Intelligence  
**Business Model:** B2B SaaS  
**Primary Market:** Mid-market and enterprise finance organizations  
**Primary Buyers:** CFO / VP Finance / Head of FP&A  
**Primary Users:** FP&A Managers, Finance Managers, Budget Owners  
**Product Role:** Decision layer over existing financial systems

---

# 1. Executive Summary

Finance organizations have mature systems for recording transactions, creating budgets, forecasting financial performance, and analyzing variances.

However, financial planning does not end when a variance is identified.

A finance team may discover that:

- one department is accelerating spending,
- another initiative is underfunded,
- priorities have changed,
- actual performance differs from the original plan,
- or budget remains locked in lower-value activities.

The market opportunity is to help finance teams move from **financial visibility to financial action**.

**Finance Budget Reallocation Intelligence** is a B2B SaaS decision-intelligence product that evaluates current budget allocation against spending behavior, business priorities, performance, and funding requirements.

It produces a financially constrained reallocation recommendation, explains the evidence behind the recommendation using AI, and routes the decision through a controlled approval workflow.

### Market positioning

> **The decision layer between financial insight and financial action.**

---

# 2. Market Problem

## 2.1 The existing finance stack is strong at visibility

Modern finance platforms provide capabilities such as:

- budgeting
- forecasting
- reporting
- variance analysis
- scenario planning
- consolidation
- workforce planning
- financial analytics

These capabilities help finance teams understand the current and expected financial position.

## 2.2 The allocation decision remains difficult

When conditions change, finance teams must answer:

> **Where should existing budget move?**

Answering this may require combining information from multiple places:

```text
Budget
+
Actual Spend
+
Forecast
+
Business Priority
+
Performance
+
Funding Requirements
+
Financial Policies
```

The decision often becomes a manual analytical workflow.

---

# 3. Market Need

The product addresses a specific market need:

### From

**"Show me the variance."**

### To

**"Tell me what financially permissible action I should consider next."**

This distinction defines the product category.

---

# 4. Target Market

## Primary Market

Mid-market companies with:

- multiple departments
- material discretionary budgets
- quarterly or annual planning cycles
- dedicated FP&A functions
- measurable initiatives
- existing finance systems

## Secondary Market

Enterprise organizations with:

- multiple business units
- complex allocation structures
- multiple financial systems
- formal approval processes
- strong governance requirements

---

# 5. Ideal Customer Profile

Our initial ideal customer should have:

### Organization

- approximately 100-5,000+ employees
- multiple departments or cost centers
- recurring budget allocation processes
- dedicated finance leadership

### Technology

Already using at least one:

- ERP
- accounting platform
- FP&A platform
- data warehouse
- business intelligence system

### Pain

The organization experiences:

- stale budgets
- manual variance investigation
- difficult mid-cycle reallocations
- fragmented financial information
- slow approval processes
- low confidence in black-box recommendations

---

# 6. Buyer Personas

## CFO

### Goals

- improve capital efficiency
- maintain financial control
- reduce unnecessary expenditure
- increase visibility
- maintain auditability

### Buying question

> **"Will this improve how effectively we allocate company resources?"**

---

## Head of FP&A

### Goals

- accelerate planning cycles
- reduce spreadsheet work
- identify allocation opportunities
- improve decision quality
- support business leaders

### Buying question

> **"Will this reduce the time between finding a problem and deciding what to do?"**

---

## Finance Manager

### Goals

- investigate anomalies
- compare initiatives
- prepare recommendations
- manage approvals
- maintain decision records

### Buying question

> **"Can I trust this recommendation and show my manager how it was calculated?"**

---

# 7. Market Requirements

## MR-01 - Financial Data Connectivity

The platform must eventually consume financial information from existing systems.

### Required capabilities

- CSV import
- REST APIs
- scheduled synchronization
- webhooks
- normalized financial schema

### Future integrations

- ERP
- accounting systems
- FP&A systems
- HR systems
- data warehouses

### MVP

Synthetic structured data only.

---

# 8. MR-02 - Budget Intelligence

The platform must understand budget allocation at multiple levels.

Required information includes:

- department
- initiative
- allocated budget
- actual spend
- remaining budget
- period
- category
- priority

---

# 9. MR-03 - Spending Pattern Detection

The product must identify meaningful deviations in spending behavior.

The initial market use case is:

> **End-of-period spending acceleration that may indicate budget misalignment.**

The platform should consider:

- historical spend rate
- current spend rate
- remaining period
- remaining budget
- planned spending

Importantly:

Approval
```

### Positioning statement

> **We don't replace the finance stack. We add a decision layer that turns financial signals into explainable, approved budget reallocation actions.**

---

# 19. Competitive Differentiation

We should avoid unsupported claims such as:

> "Competitors cannot make recommendations."

Instead, our differentiation should be based on:

### 1. Narrow decision focus

Dedicated to budget reallocation decisions.

### 2. Financially constrained recommendations

The transfer amount is calculated using deterministic financial rules.

### 3. Evidence trace

The recommendation exposes the underlying evidence.

### 4. Human approval

The system supports rather than replaces financial authority.

### 5. Integration-first strategy

The product can sit on top of existing financial infrastructure.

---

# 20. Market Positioning

### Category

**Finance Decision Intelligence**

### Subcategory

**Budget Reallocation Intelligence**

### Positioning

> **For finance teams that need to adapt budgets between planning cycles, our platform identifies allocation misalignment and recommends financially constrained budget movements with transparent reasoning and controlled approval.**

---

# 21. Customer Value

## Financial value

Potential benefits include:

- improved budget utilization
- faster response to changing priorities
- improved allocation of discretionary spending
- reduced manual analysis
- reduced budget stagnation
- better alignment between spending and performance

## Operational value

- faster finance reviews
- standardized recommendation process
- reduced spreadsheet dependency
- centralized decision history
- stronger governance

---

# 22. Adoption Drivers

The strongest adoption drivers are expected to be:

### 1. Time savings

Reduce manual budget investigation.

### 2. Decision quality

Connect spending to priority and performance.

### 3. Financial control

Keep human approval in the loop.

### 4. Explainability

Make AI recommendations defensible.

### 5. Integration

Work with existing finance infrastructure.

---

# 23. Adoption Barriers

## Trust

Finance users may not trust AI-generated financial decisions.

### Response

Deterministic calculations + evidence trace + human approval.

---

## Integration complexity

ERP and financial-system integration can be expensive.

### Response

Start with CSV/API and progressively introduce connectors.

---

## Organizational resistance

Departments may resist budget movement.

### Response

Transparent evidence and approval workflow.

---

## False positives

Not every spending anomaly represents a problem.

### Response

Treat anomalies as review signals.

---

# 24. Go-To-Market Strategy

## Initial entry point

Do not sell the product as:

> "Replace your FP&A system."

Sell it as:

> **"Improve the decisions you make between budget cycles."**

### Initial customer conversation

Start with organizations experiencing:

- frequent budget reallocations
- complex department budgets
- significant discretionary spending
- manual FP&A workflows
- multiple financial data sources

---

# 25. Land-and-Expand Strategy

### Land

Start with one use case:

**Budget reallocation intelligence.**

### Expand

Add:

- more departments
- more financial data sources
- more policies
- more recommendation types
- more approval workflows

### Eventually

Expand into broader allocation decisions:

- operating expenses
- marketing budgets
- headcount
- project funding
- capital expenditure
- resource allocation

---

# 26. Product Expansion Strategy

The product should expand based on the core decision loop.

### Stage 1

**Budget reallocation**

### Stage 2

**Continuous budget monitoring**

### Stage 3

**Cross-department allocation**

### Stage 4

**Scenario-based allocation**

### Stage 5

**Enterprise resource allocation intelligence**

The expansion should always preserve the core principle:

> **Evidence  Recommendation  Human Decision  Outcome**

---

# 27. Integration Roadmap

## Stage 1 - Hackathon

```text
Synthetic Data
CSV
JSON
```

## Stage 2 - MVP

```text
CSV
REST API
Webhooks
PostgreSQL
```

## Stage 3 - SaaS

```text
ERP
Accounting
FP&A
HR
Data Warehouse
```

## Stage 4 - Enterprise

```text
Real-time synchronization
Enterprise identity
RBAC
Policy engine

Audit
```

### Final positioning

> **"Planful, Pigment, Abacum and other finance platforms help organizations plan and understand their finances. We focus on the next decision: when the plan no longer matches reality, where should the budget move, how much can safely move, why, and who should approve it?"**

### Product mantra

> **Don't just understand the variance. Act on it - safely, transparently, and with financial control.**Multi-entity
Multi-currency
Advanced governance
```

---

# 28. AI Market Strategy

AI should be positioned as an **enabler of financial decision intelligence**, not as the product category itself.

### Weak positioning

> "AI-powered finance chatbot."

### Strong positioning

> **"AI-assisted financial decision intelligence with deterministic financial controls."**

The AI layer creates value by making complex financial evidence understandable.

The deterministic layer creates trust.


Human Approval
       The human approval layer creates governance.

---

# 29. Success Criteria

The product-market hypothesis is validated if finance users demonstrate:

### Problem validation

They frequently encounter budget misalignment requiring manual investigation.

### Solution validation

Users consider recommendations useful enough to review.

### Trust validation

Users understand and trust the evidence behind recommendations.

### Workflow validation

Users are willing to approve or modify recommendations through the platform.

Recommendation
       
### Commercial validation

Organizations demonstrate willingness to pay for continuous budget decision intelligence.

---

# 30. Key Market Hypotheses

### H1

Finance teams have a meaningful gap between detecting financial variance and determining the appropriate budget action.

### H2

Connecting budget allocation with priority and realized performance improves the quality of reallocation decisions.

### H3

Finance users require transparent evidence before acting on AI-generated recommendations.

### H4


Budget Reallocation Intelligence
       A specialized decision layer can coexist with existing ERP and FP&A systems.

### H5

Organizations will pay for measurable improvement in budget allocation efficiency.

These hypotheses should be validated through customer interviews and pilot deployments.

---

# 31. North Star Metric

### **Approved Value-Driven Reallocation**

The primary product metric should be:

> **Total value of financially approved reallocations influenced by the platform.**

Supporting metrics:

- recommendation acceptance rate
- recommendation modification rate
- recommendation review time

컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴
     DECISION GAP
컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴
       - time from signal to decision
- active finance users
- connected data sources
- recurring recommendations
- customer retention

---

# 32. Strategic Moat

The long-term moat should not depend on the underlying LLM.

The defensibility should come from:

### Financial decision history

```text
Signal
 Recommendation
 Decision
 Outcome
```


Reporting / Analytics
       ### Company-specific policies

Understanding:

- allocation rules
- approval thresholds
- reserves
- business priorities

### Integration ecosystem

Deep connectivity with existing finance systems.

### Outcome intelligence

Understanding whether previous allocation decisions produced better outcomes.

Over time, this creates a proprietary **financial decision intelligence dataset**.

---

# 33. 3-Year Strategic Direction


Planning / Forecasting
       ### Year 1

**Prove the wedge**

Budget reallocation intelligence.

### Year 2

**Become the finance decision layer**

Multiple integrations + continuous monitoring + broader allocation scenarios.

### Year 3

**Become an allocation intelligence platform**

Cross-department, cross-entity and multi-period financial resource optimization.

---

# 34. Final Market Thesis

The market does not need another system that simply produces more financial dashboards.

It needs systems that help finance teams turn financial information into controlled decisions.

Our thesis is:

> **As financial systems become better at collecting, modeling and explaining data, the next opportunity is helping finance teams act on that information.**

Our product occupies that layer.

```text
                 FINANCE STACK

ERP / Accounting
       
> **Anomaly ? waste.**

An anomaly should trigger investigation rather than automatically assigning intent or wrongdoing.

---

# 10. MR-04 - Business Priority & Performance Context

A financial anomaly alone is insufficient.

The system must connect budget allocation to business context.

Required signals:

- priority
- historical performance
- realized outcomes
- funding requirements
- remaining budget

This allows the system to distinguish between:


Evidence Trace
      ```text
High Priority + High Performance
```

and

```text
Low Priority + Low Performance
```

---

# 11. MR-05 - Reallocation Recommendation

The platform must produce a concrete recommendation.

Example:

> **Move ?4.8L from Regional Events to Customer Onboarding Automation.**

The recommendation should include:

- source

Specific Recommendation
      - target
- amount
- rationale
- evidence
- confidence
- constraints

The system must not merely generate a generic alert.

---

# 12. MR-06 - Financial Guardrails

Financial decisions require deterministic controls.

The recommendation engine must consider:

- remaining budget
- forecasted necessary spend
- safety reserve
- target funding gap
- policy maximum
- minimum remaining allocation

Financial Constraint
      
### Conceptual calculation

```text
Source Surplus =
Remaining Budget
- Necessary Future Spend
- Safety Reserve
```

```text
Transfer =
MIN(
    Source Surplus,
    Target Funding Gap,
    Policy Maximum
)
```

AI must not override these constraints.

---


Reallocation Opportunity
      # 13. MR-07 - Explainable AI

AI must provide reasoning that finance users can understand.

The system should answer:

- What was detected?
- Why was this budget selected?
- Why was another initiative selected as the target?
- What financial evidence supports the recommendation?
- Why this amount?
- What happens if nothing changes?

### AI role

**Qwen:**

- synthesize evidence
- explain reasoning
- produce structured reasoning

Our Decision Intelligence Layer
```

Budget Misalignment
      
---

# 17. Competitive Landscape

The competitive environment includes broad FP&A and finance platforms such as:

- Bob Finance
- Abacum
- Planful
- Pigment
- ERP-native planning and analytics tools
- BI and spreadsheet-based workflows

These products should not be treated as simple "competitors we replace."

They can also become **data sources or ecosystem partners**.

---

# 18. Competitive Position

## Broad FP&A platforms

Their strategic value generally comes from breadth:

```text
Planning
Forecasting
Reporting
Scenario Planning
Financial Analysis
Consolidation
Workforce Planning
```

## Our strategic value

Our differentiation comes from specialization:

```text
Financial Signals
      
### Deterministic engine:

- calculate financial values
- apply constraints
- validate recommendation

---

# 14. MR-08 - Human Approval

Financial recommendations must remain subject to human control.

Required actions:

- Approve
- Modify
- Reject

The platform must never automatically move money in the core workflow.

---


Unified Finance Data
       # 15. MR-09 - Auditability

Every financial decision should have an auditable record.

Required information:

```text
Recommendation
Source
Target
Amount
Evidence
Reasoning
Approver
Decision
Timestamp
Previous Allocation
New Allocation
```

This is essential for finance adoption.

---

# 16. MR-10 - Enterprise Integration

Long-term enterprise adoption requires interoperability.

The platform should integrate with the systems companies already use rather than forcing finance teams to replace them.

### Strategic architecture

```text
ERP / Accounting
       +
Existing FP&A
       +
HR / Workforce
       +
Data Warehouse
       
