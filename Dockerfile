# Build stage
FROM golang:1.24-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -o docker-management ./cmd/server/main.go

# Final stage
FROM alpine:3.21

# Install runtime dependencies (sqlite needs some libs if CGO is used)
RUN apk add --no-cache ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/docker-management .

# Expose the application port
EXPOSE 8080

# Command to run the application
CMD ["./docker-management"]
