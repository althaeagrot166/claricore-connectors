
# Claricore Connectors

<p align="center">
  <img src="https://img.shields.io/badge/status-active-success" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/node-20%2B-green" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" />
  <img src="https://img.shields.io/badge/Redis-BullMQ-red" />
  <img src="https://img.shields.io/badge/PostgreSQL-supported-blue" />
</p>

<p align="center">
Open-source data connector framework for building scalable ETL pipelines and integrations across enterprise systems.
</p>

---

# What is Claricore Connectors?

Claricore Connectors is a modular **data integration platform** designed to connect enterprise systems to analytics, data platforms, and AI pipelines.

It provides a scalable architecture for building connectors and running ETL pipelines across systems such as:

- Salesforce
- SAP
- Snowflake
- Databricks
- AWS
- Google Analytics
- Custom APIs

Claricore includes:

- Connector SDK
- Async job processing
- Incremental sync checkpoints
- Encrypted credential storage
- Webhook ingestion
- Scheduled pipelines
- Retry + dead-letter queues
- Observability

---

# Architecture

Claricore uses a **worker-based distributed architecture**.

```mermaid
flowchart TD

Client[Client / UI / CLI] --> API[API Service]

API --> Postgres[(PostgreSQL)]
API --> Redis[(Redis Queue)]
API --> Secrets[Secret Manager]

Postgres --> DBTables[Connections / Jobs / Checkpoints]

Redis --> Worker[Worker Service]

Worker --> Extract[Extract]
Extract --> Transform[Transform]
Transform --> Load[Load]

Load --> Destination[Destination System]

Scheduler[Scheduler Service] --> Redis
Webhook[Webhook Gateway] --> Redis

Worker --> Observability[Logs / Metrics / Tracing]
