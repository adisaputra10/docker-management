# ============================================================
# Docker Management - Makefile
# ============================================================

# Variables
APP_NAME     := docker-management
BINARY       := $(APP_NAME)
MAIN_PKG     := ./cmd/server/main.go
DOCKER_IMAGE := $(APP_NAME)
DOCKER_TAG   := latest
PORT         := 8080

# Go variables
GO           := go
GOFLAGS      := -v
CGO_ENABLED  := 1

# ============================================================
# Help
# ============================================================

.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help

# ============================================================
# Development
# ============================================================

.PHONY: build
build: ## Build the Go binary locally
	@echo "🔨 Building $(BINARY)..."
	CGO_ENABLED=$(CGO_ENABLED) $(GO) build $(GOFLAGS) -o $(BINARY) $(MAIN_PKG)
	@echo "✅ Build complete: ./$(BINARY)"

.PHONY: run
run: build ## Build and run the application locally
	@echo "🚀 Starting $(BINARY) on port $(PORT)..."
	./$(BINARY)

.PHONY: dev
dev: ## Run the application with live reload (requires air)
	@command -v air > /dev/null 2>&1 || { echo "❌ 'air' is not installed. Run: go install github.com/air-verse/air@latest"; exit 1; }
	air

.PHONY: tidy
tidy: ## Tidy and verify Go modules
	@echo "📦 Tidying Go modules..."
	$(GO) mod tidy
	$(GO) mod verify
	@echo "✅ Modules tidied"

.PHONY: test
test: ## Run tests
	@echo "🧪 Running tests..."
	CGO_ENABLED=$(CGO_ENABLED) $(GO) test ./... -v
	@echo "✅ Tests complete"

.PHONY: lint
lint: ## Run linter (requires golangci-lint)
	@command -v golangci-lint > /dev/null 2>&1 || { echo "❌ 'golangci-lint' is not installed. See: https://golangci-lint.run/welcome/install/"; exit 1; }
	golangci-lint run ./...

.PHONY: clean
clean: ## Remove build artifacts
	@echo "🧹 Cleaning..."
	rm -f $(BINARY)
	rm -f *.db
	rm -f *.log
	@echo "✅ Clean complete"

# ============================================================
# Docker
# ============================================================

.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "🐳 Building Docker image $(DOCKER_IMAGE):$(DOCKER_TAG)..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	@echo "✅ Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)"

.PHONY: docker-run
docker-run: ## Run Docker container
	@echo "🐳 Running $(DOCKER_IMAGE):$(DOCKER_TAG) on port $(PORT)..."
	docker run -d \
		--name $(APP_NAME) \
		-p $(PORT):8080 \
		-v /var/run/docker.sock:/var/run/docker.sock \
		$(DOCKER_IMAGE):$(DOCKER_TAG)
	@echo "✅ Container started: http://localhost:$(PORT)"

.PHONY: docker-stop
docker-stop: ## Stop and remove Docker container
	@echo "🛑 Stopping $(APP_NAME)..."
	docker stop $(APP_NAME) 2>/dev/null || true
	docker rm $(APP_NAME) 2>/dev/null || true
	@echo "✅ Container stopped"

.PHONY: docker-restart
docker-restart: docker-stop docker-run ## Restart Docker container

.PHONY: docker-logs
docker-logs: ## Show Docker container logs
	docker logs -f $(APP_NAME)

.PHONY: docker-shell
docker-shell: ## Open a shell in the running container
	docker exec -it $(APP_NAME) /bin/sh

.PHONY: docker-clean
docker-clean: docker-stop ## Stop container and remove Docker image
	@echo "🧹 Removing Docker image..."
	docker rmi $(DOCKER_IMAGE):$(DOCKER_TAG) 2>/dev/null || true
	@echo "✅ Docker image removed"

.PHONY: docker-rebuild
docker-rebuild: docker-clean docker-build docker-run ## Full rebuild: stop, remove, build, and run

# ============================================================
# Compose (if docker-compose.yml exists)
# ============================================================

.PHONY: up
up: ## Start services with docker compose
	docker compose up -d --build
	@echo "✅ Services started"

.PHONY: down
down: ## Stop services with docker compose
	docker compose down
	@echo "✅ Services stopped"

.PHONY: logs
logs: ## Show docker compose logs
	docker compose logs -f
