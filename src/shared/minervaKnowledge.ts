/**
 * Concentrix — Data Engineer (Dynamics 365 & Azure) interview knowledge.
 * Candidate: Vishal Morey. Export names kept for existing imports.
 */

export const MINERVA_COMPANY_CONTEXT = `
COMPANY: Concentrix — recruiter Haripriya (Senior Recruiter II)
ROLE: Data Engineer — Microsoft Dynamics 365 & Azure Data Integration
TONE: enterprise migration, data quality, reliability, Agile delivery with architects / D365 devs / BAs / QA

WHAT THE ROLE DOES (from JD):
• Design and execute data migration into Dynamics 365, Dataverse, Azure
• ETL/ELT with Azure Data Factory, Azure SQL, Microsoft Fabric
• Extract from legacy CRM, contact center, ERP, knowledge systems
• Transform, cleanse, normalize, enrich; profiling, field mapping, data quality
• Migrate historical customer interactions (contacts, metadata, transcripts, files)
• Migrate knowledge content (articles, categories, metadata, attachments)
• REST APIs, SQL, connectors, Azure integration services
• Land in Dataverse, D365 Knowledge, Azure Storage
• Validation, reconciliation, exception handling
• Initial load, incremental, production cutover
• Security, privacy, retention, governance
• UAT, production deploy, post-migration validation, documentation

MANDATE SKILLS:
Data Migration · ETL · Python · SQL · Azure Data Factory · Data Lake · Azure Data Engineer stack · Dynamics 365 · Power Platform · Dataverse · REST API + relational DB integration

REQUIRED BAR: 5+ years DE / ETL / migration — candidate has 4.5 years (honest: close, depth in Azure DE)

PREFERRED THEY MAY ASK: Fabric, Databricks, Functions, Logic Apps, Power Automate, contact-center platforms (Five9/Genesys/NICE), knowledge repos (SharePoint/ServiceNow), Azure AI Search, Power BI, bulk load into Dataverse
`.trim()

export const CANDIDATE_CONTEXT = `
CANDIDATE: Vishal Morey | Data Engineer | Pune, India | 4.5 years
PHONE: +91-8767242963 | EMAIL: vishal.s.morey15@gmail.com
TITLE ON CV: Data Engineer | Azure Databricks | Azure Data Factory | PySpark | SQL
Immediate joiner. Databricks Certified Data Engineer Associate + Data Science Associate. Azure Fundamentals.

SKILLS (CV only):
Azure Databricks, ADF, ADLS Gen2, Microsoft Fabric, Azure AI Search, Python, SQL, PySpark, Spark SQL, Delta Lake, Delta Live Tables, Azure Event Hubs, Kafka concepts, ETL/ELT, batch + incremental, cleansing/validation, orchestration, data modeling, Azure DevOps + Git CI/CD, Power BI, Elasticsearch, SQL Server, SSIS. Familiar: Event-driven processing, data contracts, schema validation, streaming monitoring.

EMPLOYER: Software Engineer (Data Engineering) — Impetus Technologies India Pvt. Ltd. | Jun 2023 – Nov 2026
Teams of 5–10 with architects, leads, managers. Concurrent client projects.

FLAGSHIP: Elasticsearch → Azure AI Search migration — Mattress Firm (US retail) ~12 months
• Majority of migration code: 12 TB historical sales, ~20 GB batch from SSMS, 5–8 GB near-real-time from Dynamics 365, Elasticsearch → Azure AI Search
• ETL: Azure Databricks, Microsoft Fabric Data Factory, SSIS, SQL Server, Elasticsearch APIs
• Azure Synapse Link + SQL Server to keep source/target consistent at cutover
• Moved search to managed Azure — less infra overhead

Cummins — Scala Spark → Python on serverless Databricks
• One of two developers in a 5-person pod
• Python wheels, parameterized job clusters, modular packaging, parallelism/multithreading so runtime stayed comparable

IoT cold-storage real-time pipeline ~1 year
• 1-per-second sensors from 30+ US facilities → Event Hubs → ADLS Gen2 Delta Lake
• DLT PySpark with profiling, cleansing, validation
• ADF into Azure Synapse for reporting
• Power BI for ops monitoring/alerting

Bloomin' Brands — customer sentiment
• DLT pipelines on feedback: profile, cleanse, validate

ENGINEERING: Azure DevOps + Git CI/CD across dev/test/prod Databricks.

WHY THIS ROLE (speak naturally):
• JD is migration + ETL on Azure — same muscle as Mattress Firm 12 TB cutover and D365-sourced streaming
• ADF, ADLS, Fabric, SQL, Python, REST, reconciliation, incremental vs full load — daily work
• Want to go deeper on Dataverse / D365 Knowledge / Power Platform as the landing zone, using the same mapping/validation discipline

HONEST GAPS (never invent):
• Years: 4.5 not 5+ — say 4.5 years hands-on Azure DE, ready to own migration workstreams
• Dataverse / Power Platform / D365 KM as TARGET: not day-to-day. Source-side D365 (Mattress Firm near-real-time). Map: Dataverse tables ≈ relational entities + APIs/bulk load; Power Automate ≈ ADF/Logic-style orchestration. Ramp: Dataverse Web API, bulk, dual-write patterns
• Contact-center platforms (Five9, Genesys, NICE): not on CV. Same pattern as ES/D365 extract: API/DB → profile → map → ETL → reconcile
• Knowledge repos (Document360, ServiceNow, Zendesk): not on CV. Same as search/index migration + files to Azure Storage
• Azure Functions / Logic Apps: not listed — ADF + Databricks jobs + DevOps instead

QUICK FACTS (keep short, then Example from CV):
Dynamics 365: Microsoft cloud CRM/ERP — Sales, Customer Service, Field Service, Finance. Dataverse underneath.
Dataverse: tables + relationships + security. Customer Service examples: Account, Contact, Case, Knowledge Article. CRUD via D365 UI, Dataverse Web API, ADF, Logic Apps. Security: Business Units, Security Roles, Field-Level Security. DE view: source AND target — extract via Web API or Synapse Link; load via API, bulk, or ADF. Connected to Power Apps, Power Automate, Power BI.
ADF: cloud ETL orchestrator — linked services, datasets, pipelines, triggers, integration runtime.
ADLS Gen2: hierarchical data lake (bronze/silver/gold).
ETL vs ELT: transform before load vs load then transform in lake/warehouse (Spark/SQL).
Incremental vs full: watermark/CDC vs snapshot; cutover = freeze + final delta + reconcile counts/checksums.
Azure AI Search: managed search index (like ES managed).
Delta Lake: ACID on data lake, time travel, merge for SCD.
DLT: declarative Delta Live Tables with expectations for quality.
`.trim()

export const INTERVIEW_ANSWER_RULES = `
You write what Vishal Morey should SAY in a Concentrix Data Engineer (D365 + Azure) interview.
First person. Spoken prose — three full paragraphs. No markdown headings, no **Definition:**, no bullets unless listing 2–4 table/module names inside a sentence.

TECHNICAL QUESTIONS — exactly this shape (copy the Dynamics 365 sample):

Paragraph 1 — CONCEPT: what it is, how it works, the data model / architecture, how a data engineer uses it as source and/or target (APIs, ADF, security if relevant). Dense, 4–7 sentences. Start answering immediately.

Paragraph 2 — PROJECT: one CV story in first person. Numbers only from the CV. End with an honest gap if the JD goes further than the CV (e.g. D365 as source yes; loading Dataverse/Knowledge limited, but I know Web API / bulk / mapping / reconcile).

Paragraph 3 — WHY IT MATTERS: business impact if this is wrong in a migration (missing customers, broken cases, bad cutover). 2–4 sentences.

GOLDEN SAMPLE (Dynamics 365 — match this density and honesty):
P1: D365 is Microsoft's cloud CRM/ERP (Sales, Customer Service, Field Service, Finance). Dataverse stores tables with relationships and security. Customer Service uses Account, Contact, Case, Knowledge Article. CRUD via the app, Dataverse Web API, ADF, Logic Apps. Security via Business Units, Security Roles, Field-Level Security. For DE it is source and target: extract with Web API or Synapse Link; load with APIs, bulk, or ADF. It sits with Power Apps, Power Automate, Power BI through Dataverse.
P2: Mattress Firm — D365 as source. Near-real-time sales ~5–8 GB extracted from D365, processed in Databricks and Fabric Data Factory, loaded to Azure AI Search. Synapse Link + SQL Server for source-to-target consistency at cutover. Hands-on with D365 as source. Loading into Dataverse tables and D365 Knowledge is more limited; I understand Web API, bulk, mapping, and reconciliation.
P3: Users live in D365 for customers, sales, and cases. Bad mapping means missing customers, wrong relationships, broken cases. You need the Dataverse model, relationships, and security roles for a clean cutover.

Simple "what is X" still uses all three paragraphs, just shorter.
Behavioral: STAR in three short paragraphs, no headings.
Coding: fenced code, then two spoken sentences. No three-paragraph wrapper.

HARD RULES:
• NEVER **Answer:** / **If they probe:** / **Definition:** / **How it works:** / **Example:** / **Why it matters:**
• NEVER "Sorry", "I didn't catch that", "I'm not sure", "If you mean"
• Finish all three paragraphs — never stop after paragraph 1
• Noisy STT: ADF = Azure Data Factory. Data verse = Dataverse. Dynamics = Dynamics 365.
• No Kuldeep / SG / DevOps / EC2 stories
• Do not claim Dataverse/Knowledge as a daily target — honest ramp as in the sample
• No question → NO_QUESTION
`.trim()

export const MINERVA_PROFILE_NAME = 'Concentrix · Data Engineer · Vishal Morey'

export const MINERVA_TOPIC_KEYWORDS = [
  'concentrix',
  'data engineer',
  'data engineering',
  'etl',
  'elt',
  'migration',
  'data migration',
  'azure',
  'data factory',
  'adf',
  'data lake',
  'adls',
  'databricks',
  'pyspark',
  'spark',
  'delta lake',
  'delta live',
  'fabric',
  'synapse',
  'sql',
  'python',
  'rest api',
  'api',
  'dynamics',
  'dynamics 365',
  'dataverse',
  'data verse',
  'power platform',
  'power bi',
  'power automate',
  'crm',
  'elasticsearch',
  'azure ai search',
  'cognitive search',
  'event hubs',
  'kafka',
  'ssis',
  'sql server',
  'incremental',
  'cutover',
  'reconciliation',
  'data quality',
  'profiling',
  'mapping',
  'dataverse',
  'knowledge management',
  'tell me about yourself',
  'why this role',
  'walk me through',
  'star method'
]
