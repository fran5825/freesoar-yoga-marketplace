# ADR 0004: AI Collaboration Rules

## Status

Draft

## Decision

AI agents can assist with planning, coding, testing, reviewing, and documentation, but must operate within this repository's Harness rules.

## Rules

- Read AGENTS.md before implementing.
- Follow spec → plan → build → test → review → ship.
- Do not change data model without explaining impact.
- Do not change permissions without security review.
- Do not overbuild outside V1.
- Update docs when architecture changes.

## Rationale

This project uses AI heavily, so development rules must be explicit and persistent.
