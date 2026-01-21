# Stackstarter Development Makefile

.PHONY: help install test clean lint format docker-build docker-run docker-stop setup env-setup info

help: ## Show this help message
	@echo "Stackstarter Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

test: ## Run tests
	npm test

clean: ## Clean build artifacts
	rm -rf node_modules/.cache

lint: ## Lint code (placeholder)
	@echo "No lint configuration found."

format: ## Format code (placeholder)
	@echo "No format configuration found."

docker-build: ## Build Docker image
	docker build -t stackstarter .

docker-run: ## Run tests in Docker
	docker run --rm -v $$PWD:/app -w /app stackstarter

docker-stop: ## No-op for local dev
	@echo "Nothing to stop."

setup: install ## Setup development environment
	@echo "Setup complete."

env-setup: ## Create .env template
	@echo "Creating .env file..."
	@echo "# Stackstarter env" > .env
	@echo "NODE_ENV=development" >> .env

info: ## Show project information
	@echo "Stackstarter"
	@echo "Framework: Clarity (Blockstack)"
	@echo "Tests: Mocha"