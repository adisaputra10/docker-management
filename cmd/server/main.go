package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"log"
	"math/big"
	"net"
	"net/http"
	"time"

	"github.com/adisaputra10/docker-management/internal/api"
	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/adisaputra10/docker-management/web"

	"github.com/docker/docker/client"
	"github.com/rs/cors"
)

func generateSelfSignedCert() (tls.Certificate, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{Organization: []string{"docker-management"}},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1"), net.IPv6loopback},
		DNSNames:     []string{"localhost"},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	return tls.X509KeyPair(certPEM, keyPEM)
}

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

	// Start HTTPS server on 8443 for kubectl proxy (kubectl ≥1.27 won't send
	// Bearer tokens to plain http:// endpoints due to a security restriction)
	go func() {
		cert, err := generateSelfSignedCert()
		if err != nil {
			log.Printf("Warning: could not generate TLS cert, HTTPS proxy unavailable: %v", err)
			return
		}
		tlsSrv := &http.Server{
			Addr:    ":8443",
			Handler: handler,
			TLSConfig: &tls.Config{
				Certificates: []tls.Certificate{cert},
			},
		}
		log.Printf("🔒 HTTPS server starting on https://localhost:8443 (kubectl proxy)")
		if err := tlsSrv.ListenAndServeTLS("", ""); err != nil {
			log.Printf("HTTPS server error: %v", err)
		}
	}()

	// Start HTTP server (web UI)
	port := "8080"
	log.Printf("🚀 Server starting on http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}
