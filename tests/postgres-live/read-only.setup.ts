import { loadPostgresTarget, verifyPostgresTarget } from "../../verification/postgres-target";

// This suite verifies an empty target before importing any application client.
const result = await verifyPostgresTarget(loadPostgresTarget());
(globalThis as typeof globalThis & { postgresPreflight?: typeof result }).postgresPreflight = result;
