SHELL := /bin/bash

install:
	npm install

# Lint all local XDRS documents (excludes external _core scope)
lint:
	npx xdrs-core lint .

# Lint including external scopes
lint-all:
	npx xdrs-core lint --all .

clean:
	rm -rf dist node_modules .filedist.lock
