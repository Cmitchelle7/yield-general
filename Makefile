# YieldAnchor Protocol — Rust/Soroban automation only.
#
# Everything JavaScript/TypeScript (install, build, typecheck, lint, format,
# dev servers) lives in package.json and runs through pnpm:
#
#   pnpm run --silent               # list all workspace scripts
#   pnpm install                    # install the workspace
#   pnpm run lint | format | typecheck
#
# The targets below are the Rust half of the toolchain. They are equivalent to
# the `contract:*` scripts in package.json, which stay available so the
# server-side toolchain does not require make. Rust formatting and linting are
# owned by rustfmt and clippy here, never by Prettier/ESLint.

CARGO ?= cargo
CONTRACT := yield_vault
WASM_TARGET := wasm32-unknown-unknown
MANIFEST := contracts/yield_vault/Cargo.toml
WASM_OUT := target/$(WASM_TARGET)/release/$(CONTRACT).wasm
DEPLOY_SCRIPT := scripts/deploy/deploy-yield-vault.sh

.PHONY: help contract-build contract-check contract-test contract-fmt contract-fmt-check contract-clippy deploy clean

help:
	@echo "Rust / Soroban targets (make):"
	@echo "  make contract-build      cargo build --release --target $(WASM_TARGET)  ->  pnpm run contract:build"
	@echo "  make contract-check      cargo check -p $(CONTRACT)                     ->  pnpm run contract:check"
	@echo "  make contract-test       cargo test -p $(CONTRACT)                      ->  pnpm run contract:test"
	@echo "  make contract-fmt        cargo fmt --all                                ->  pnpm run contract:fmt"
	@echo "  make contract-fmt-check  cargo fmt --all -- --check                    ->  pnpm run contract:fmt:check"
	@echo "  make contract-clippy     cargo clippy -p $(CONTRACT) --all-targets -- -D warnings"
	@echo "  make deploy              Testnet deploy via $(DEPLOY_SCRIPT)"
	@echo "  make clean               cargo clean"
	@echo ""
	@echo "Node / TypeScript targets live in package.json — run 'pnpm run' to list them."

# Compile the Phase 1 YieldVault contract to wasm for Soroban deployment.
contract-build:
	$(CARGO) build --manifest-path $(MANIFEST) --target $(WASM_TARGET) --release
	@echo "WASM expected at $(WASM_OUT)"

contract-check:
	$(CARGO) check -p $(CONTRACT)

contract-test:
	$(CARGO) test -p $(CONTRACT)

contract-fmt:
	$(CARGO) fmt --all

contract-fmt-check:
	$(CARGO) fmt --all -- --check

contract-clippy:
	$(CARGO) clippy -p $(CONTRACT) --all-targets -- -D warnings

# Testnet-only deployment aid; requires the stellar CLI and a funded identity.
deploy:
	bash $(DEPLOY_SCRIPT)

clean:
	$(CARGO) clean
