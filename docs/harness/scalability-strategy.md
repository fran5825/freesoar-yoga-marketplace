# Scalability Strategy

## Principle

The V1 tech stack should support MVP to early/mid-stage marketplace growth.
Future scaling should happen through architecture evolution, not a full rewrite.

## Current Stack Can Support

- MVP
- Early operations
- Small to medium marketplace
- SEO/marketing pages
- Basic dashboards
- Teacher/organizer/member workflows

## Avoid Early Overengineering

Do not start with:

- Microservices
- Kubernetes
- Event sourcing
- Native app
- Complex queue systems
- Advanced enterprise billing

## Design for Evolution

Keep boundaries clean:

- UI layer
- Domain/service layer
- Data access layer
- Permission layer
- Notification layer
- Scheduling layer

## Future Scaling Moves

| Pressure | Evolution |
|---|---|
| Search becomes complex | Add Meilisearch / Typesense / Algolia |
| Notifications increase | Add queue + background worker |
| Scheduling becomes complex | Extract scheduling domain service |
| Reports become heavy | Add reporting layer / read replica |
| App becomes necessary | Add API boundary + React Native / Expo |
| Enterprise plans grow | Add organization RBAC + billing module |
| Traffic increases | Add cache / CDN / optimized queries |

## Scalability Gate

Before merging major features:

- Does this create unnecessary coupling?
- Are queries likely to scale?
- Are indexes needed?
- Does this belong in domain service?
- Does this block future app support?
- Does this affect scheduling/search/notification pressure?
