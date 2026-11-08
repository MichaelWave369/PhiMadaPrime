# ΦMada Prime ↔ Agentora ↔ RepoNerve public view R1

**Status:** manually imported, public-only observation view. No agents are
created, assigned, dispatched, merged, or deployed by this integration.

## Using the view

1. Start PhiRepoNerve locally, scan the GitHub account, and verify the local
   scan succeeded (current RepoNerve Rung 1 API binds 127.0.0.1:8765).
2. Use the Agentora bridge branch/release to export a redacted file:

   python scripts/export_phireponerve_public.py --output ./fleet-public.json

3. Review the exported JSON before sharing it. Open the public ΦMadaPrime
   website's **RepoNerve** tab and select the file. The data is loaded into
   this browser session only, not uploaded to a service.
4. Matching public GitHub catalog IDs must be live, and the scan must be recent.
   Unknown or private identities are rejected rather than quietly displayed.

The browser never connects to the local RepoNerve port. A public GitHub Pages
site must not fetch an unauthenticated loopback API or embed private fleet data.

## Trust boundaries

The input uses schema phireponerve.agentora.public-observations.v1.
Strict key checks reject private fields and action payloads. Identity matching
uses GitHub numeric IDs; source-only and no-authority fields are mandatory.
Events include only whitelisted public metadata kinds, with no historical
before/after values or private project names. Observations are not CI evidence,
release qualification, or permission to execute.

The import view is complementary to the existing Agentora public pilot,
coverage ledger and manual fleet audit plan. No background upload, worker
dispatch, auto-merge, arbitrary API URL, or live status claims are added.

## Next rung

Introduce a separately reviewed public JSON artifact publisher with explicit
privacy filters, freshness and integrity receipts; retain the authenticated
local-only path for private inventory. Then add Agentora steward-state and
leased-worker evidence once independent executor/verification policies exist.
