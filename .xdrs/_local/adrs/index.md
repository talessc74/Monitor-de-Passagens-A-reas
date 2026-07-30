# _local ADRs Index

Architectural and technical decisions for FlySpot.

## data

Data architecture and information modeling choices.

- [001-passenger-and-date-flexibility-model](data/001-passenger-and-date-flexibility-model.md) — `FlightMonitor.passengers` splits into adults/children/infants, and dates gain an optional flexibility window (`flexDays`), driven by `_local-bdr-policy-001`
