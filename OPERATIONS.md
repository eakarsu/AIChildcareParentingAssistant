# Governed care operations

The production-boundary workflow is \`/api/governed-care\`: guardian-consented plan → professional review → approval → active care. Incidents are classified deterministically; high/emergency incidents create a durable human-escalation outbox event. Creation requires bearer auth, \`x-tenant-id\`, and \`idempotency-key\`; memberships live in \`care_tenant_memberships\`.

Care-provider, calendar, messaging, emergency-contact, and consented health/device adapters remain deployment integrations. They require qualified safeguarding/clinical review, response-time exercises, privacy agreements, and real provider credentials. No model output is permitted to approve a plan or close an incident.

## Safe lifecycle

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Run `scripts/bootstrap.sh` once to install locked dependencies.
3. Run `scripts/migrate.sh` explicitly against the intended database.
4. Provision tenant memberships through an audited administrator process.
5. Run `./start.sh`; it never installs, seeds, migrates, starts PostgreSQL, or kills ports.

Legacy seed data is demo-only. Where `scripts/seed-demo.sh` exists it requires `CONFIRM_DEMO_SEED=yes` and refuses production. External provider calls and production data were not exercised by this implementation.
