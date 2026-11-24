# SafeConnect: Software Requirements Specification (SRS)

This directory contains the finalized Software Requirements Specification (SRS) for **SafeConnect** (Version 3.0), developed as a Daffodil International University (DIU) B1 Capstone Project.

## Documents & Assets

- **[SafeConnect_SRS.pdf](SafeConnect_SRS.pdf)**: Complete 85-page formal project report and SRS specification submitted for DIU Fall 2026. Includes all 16 Functional Requirements (`FR01`–`FR16`), 9 Non-Functional Requirements (`NFR01`–`NFR09`), 17 Use Case descriptions, 18 Activity diagrams, 17 Sequence diagrams, Class diagram, ER diagram, and User Manual.
- **[SafeConnect_SRS.md](SafeConnect_SRS.md)**: Bangla-first detailed SRS document covering requirements, architecture, data schemas, and implementation roadmap.
- **[Screenshots & Verification](screenshots/README.md)**: Verified screenshots corresponding to the 9 user manual sections (pages 84–85 of the SRS) taken from the live PWA application.

## Quick Summary of Requirements

- **Functional Requirements (`FR01`–`FR16`)**: User registration/auth, profile preferences, smart search with phonetic aliases, 12 facility categories with road distance, community status updates (*Ekhon Kemon?*), sticky 999 emergency dialer, situation-based offline SOS SMS, verified grassroots government directory, dynamic live location sharing (15m/1h/8h), Safe Commute vehicle logging, zero-login family tracking view, "Dakun" on-demand rides and services with fallback stands, provider onboarding and availability, fair fare calculation with digital receipt, error reporting, and auditable admin panel.
- **Non-Functional Requirements (`NFR01`–`NFR09`)**: Offline resilience, privacy by design (100m coordinate rounding, no background tracking), server-side rule security, zero-budget free tier scalability, bilingual localization (Bangla first), accessibility and responsive layout (320px–1440px), real-time updates (5–10s freshness), data integrity and append-only audit logging, installable PWA portability.
