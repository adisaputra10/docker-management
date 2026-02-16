package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/adisaputra10/docker-management/internal/api"
	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/adisaputra10/docker-management/web"

	"github.com/docker/docker/client"
	"github.com/rs/cors"
)

func main() {
	// Initialize database
	if err := database.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()
	log.Println("✓ Database initialized")

	// Initialize Docker client (optional check)
	defaultClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, pingErr := defaultClient.Ping(ctx)
		if pingErr == nil {
			log.Println("✓ Successfully connected to local Docker daemon")
			// Set as default fallback client
			api.DefaultClient = defaultClient
		} else {
			log.Printf("Warning: Failed to connect to local Docker daemon: %v", pingErr)
		}
	} else {
		log.Printf("Warning: Failed to create Docker client: %v", err)
	}

	// Setup router
	r := api.NewRouter()

	// Serve static files from embedded FS
	r.PathPrefix("/").Handler(http.FileServer(http.FS(web.Content)))

	// CORS middleware
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Docker-Host-ID"},
		AllowCredentials: true,
	}).Handler(r)

	// Start server
	port := "8080"
	log.Printf("🚀 Server starting on http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}
