# Asparkle OS — Core Project Skill

## Project Overview

Asparkle OS is a custom ERP/CRM system for a perfume business.

### Stack
- React
- Vite
- Tailwind CSS
- Firebase Firestore
- Vercel

### Main Domains
- Inventory
- Orders
- CRM
- Returns
- Dashboard & Reporting

---

# Core Inventory Rules

## Source of Truth

`stock_movements` is the primary inventory ledger.

`stock_snapshot` is only a cache/reference imported from Between Items List.

Never treat `stock_snapshot` as the real ledger.

---

## Inventory Formula

### Official Stock

SUM(ADD)
- SUM(SALE/deducted)
+ SUM(RETURN)
+ SUM(UPDATE)

Net Available Stock
official_stock
- DAMAGE
- MISSING
Critical Rule

DAMAGE and MISSING must NEVER be deducted inside snapshot calculations.

Correct logic:

snapshot = movement calculations only

net = snapshot - damage - missing

Movement Types
Supported Internal Types
ADD
SALE
RETURN
UPDATE
DAMAGE
MISSING
Between Mappings
Between Type	Internal Type
Add	ADD
deducted	SALE
return	RETURN
Update	UPDATE
Important

DAMAGE and MISSING are manual internal adjustments only.

They never originate from Between.

Deduplication Rules
Critical Dedup Key
`${rowNo}_${sku}`
Never deduplicate by:
AWB
SKU only
Reason

Same AWB can contain:

multiple pallets
multiple locations
multiple independent rows

Each rowNo represents a separate inventory row.

Between Import Assumptions
Official Stock Reference

Between Items List is considered the official stock reference.

Items List automatically aggregates quantities across locations.

Expected Movement Export Behavior

Movement exports may contain:

duplicated AWBs
split rows
multiple locations
repeated SKUs

This is expected behavior.

Do not collapse rows automatically.

Time Machine Rules

Historical inventory is reconstructed from movements.

Core Function
buildSnapshotAtDate(movements, beforeDate)
Rules
snapshot must ignore DAMAGE/MISSING
historical stock is movement-based only
net stock is calculated after snapshot generation
SKU Rules
Important SKU
09000903

Contains a leading zero.

Critical Rule

Never:

parse SKUs as numbers
auto-normalize SKUs
trim leading zeros

Always preserve SKU strings exactly as received.

Firestore Architecture
Base Path
artifacts/{appId}/public/data/
Main Collections
Collection	Purpose
stock_movements	Primary inventory ledger
stock_snapshot	Cached Between stock
orders	Orders
movements	Legacy sales movements
cs_returns	Customer service returns
settings/definitions	Product definitions/packages
Important Files
Core Inventory Logic
StockTab.jsx
BetweenImportTab.jsx
Global State
useAppData.js
Mapping Logic
masterMapping.js
Development Rules
Inventory Logic Changes

When modifying inventory logic:

prefer minimal safe fixes
avoid unnecessary refactors
preserve backward compatibility
do not rewrite architecture unless explicitly requested
Dangerous Changes

Never change:

dedup logic
snapshot philosophy
movement type meanings

Unless explicitly requested.

Project Philosophy

The system prioritizes:

inventory correctness
auditability
reproducible historical stock states

Performance optimizations must never break inventory accuracy.

Preferred AI Response Style

Preferred structure:

quick understanding
exact issue
minimal fix
final code
possible side effects

Ask concise technical questions only when necessary.
