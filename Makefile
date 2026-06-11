SHELL := /bin/bash

dev:
	npm run dev

build:
	npm run build

# Extract / update governance files (run after npm install)
extract:
	npx argus-xdrs-governance

# Verify governance files are in sync with the distributed package
check:
	npx argus-xdrs-governance check

# Lint XDRS decision records
lint:
	npx xdrs-core lint .
