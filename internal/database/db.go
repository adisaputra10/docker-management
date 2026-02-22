package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/adisaputra10/docker-management/internal/models"
	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() error {
	var err error

	// Create database directory if it doesn't exist
	if err := os.MkdirAll("./database", 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %v", err)
	}

	DB, err = sql.Open("sqlite", "./database/docker-manager.db")
	if err != nil {
		return err
	}

	// Set connection pool settings for better concurrency
	DB.SetMaxOpenConns(1) // SQLite works best with single writer
	DB.SetMaxIdleConns(1)
	DB.SetConnMaxLifetime(0)

	// Enable WAL mode for better concurrency
	if _, err := DB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		log.Printf("Warning: Failed to enable WAL mode: %v", err)
	}

	// Set busy timeout
	if _, err := DB.Exec("PRAGMA busy_timeout=5000;"); err != nil {
		log.Printf("Warning: Failed to set busy timeout: %v", err)
	}

	// Create activity_logs table
	query := `
	CREATE TABLE IF NOT EXISTS activity_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		action TEXT NOT NULL,
		target TEXT NOT NULL,
		details TEXT,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		status TEXT NOT NULL
	);
	`
	if _, err = DB.Exec(query); err != nil {
		return err
	}

	// Create docker_hosts table
	queryHosts := `
	CREATE TABLE IF NOT EXISTS docker_hosts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		uri TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err = DB.Exec(queryHosts); err != nil {
		return err
	}

	// Create settings table
	querySettings := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`
	if _, err = DB.Exec(querySettings); err != nil {
		return err
	}

	// Create users table
	queryUsers := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		role TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err = DB.Exec(queryUsers); err != nil {
		return err
	}

	// Create projects table
	queryProjects := `
	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		description TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err = DB.Exec(queryProjects); err != nil {
		return err
	}

	// Create project_allocations (Users -> Projects)
	queryUserProjects := `
	CREATE TABLE IF NOT EXISTS project_users (
		project_id INTEGER,
		user_id INTEGER,
		PRIMARY KEY (project_id, user_id),
		FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	`
	if _, err = DB.Exec(queryUserProjects); err != nil {
		return err
	}

	// Create project_resources (Containers -> Projects)
	// Storing identifier (Name) instead of ID because ID changes on recreation
	queryProjectResources := `
	CREATE TABLE IF NOT EXISTS project_resources (
		project_id INTEGER,
		host_id INTEGER,
		resource_identifier TEXT NOT NULL, 
		resource_type TEXT DEFAULT 'container',
		PRIMARY KEY (project_id, host_id, resource_identifier),
		FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
	);
	`
	if _, err = DB.Exec(queryProjectResources); err != nil {
		return err
	}

	// Seed Default Admin (admin / admin)
	// Using simple SHA256 for MVP portability (avoiding external deps like bcrypt for now)
	// Hash of "admin" = 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
	querySeed := `
	INSERT OR IGNORE INTO users (username, password, role) 
	VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'admin');
	`
	if _, err = DB.Exec(querySeed); err != nil {
		return err
	}

	// Create sessions table
	querySessions := `
	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL,
		role TEXT NOT NULL,
		expires_at DATETIME NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	`
	if _, err = DB.Exec(querySessions); err != nil {
		return err
	}

	// Create load_balancer_routes table
	queryRoutes := `
	CREATE TABLE IF NOT EXISTS load_balancer_routes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		domain TEXT NOT NULL,
		host_id INTEGER,
		container_name TEXT, 
		container_port INTEGER,
		manual_ip TEXT,
		manual_port INTEGER,
		target_type TEXT CHECK(target_type IN ('container', 'manual')),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(host_id) REFERENCES docker_hosts(id) ON DELETE SET NULL
	);
	`
	if _, err = DB.Exec(queryRoutes); err != nil {
		return err
	}

	// Create k0s_clusters table
	queryK0s := `
	CREATE TABLE IF NOT EXISTS k0s_clusters (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		ip_address TEXT NOT NULL,
		username TEXT,
		password TEXT,
		auth_method TEXT DEFAULT 'password',
		ssh_key TEXT,
		kubeconfig TEXT,
		status TEXT DEFAULT 'provisioning',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		version TEXT,
		node_count INTEGER DEFAULT 1,
		type TEXT DEFAULT 'controller'
	);
	`
	if _, err = DB.Exec(queryK0s); err != nil {
		return err
	}
	// Migrate: add auth columns if not exist (for existing databases)
	for _, col := range []string{
		"ALTER TABLE k0s_clusters ADD COLUMN password TEXT",
		"ALTER TABLE k0s_clusters ADD COLUMN auth_method TEXT DEFAULT 'password'",
		"ALTER TABLE k0s_clusters ADD COLUMN ssh_key TEXT",
		"ALTER TABLE k0s_clusters ADD COLUMN kubeconfig TEXT",
	} {
		DB.Exec(col) // ignore error if column already exists
	}

	// Create k0s_nodes table
	queryK0sNodes := `
	CREATE TABLE IF NOT EXISTS k0s_nodes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cluster_id INTEGER NOT NULL,
		ip_address TEXT NOT NULL,
		hostname TEXT,
		role TEXT NOT NULL CHECK(role IN ('controller', 'worker')),
		status TEXT DEFAULT 'active',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(cluster_id) REFERENCES k0s_clusters(id) ON DELETE CASCADE,
		UNIQUE(cluster_id, ip_address)
	);
	`
	if _, err = DB.Exec(queryK0sNodes); err != nil {
		return err
	}

	// Create user_namespaces table (map users to k8s namespaces per cluster)
	queryUserNamespaces := `
	CREATE TABLE IF NOT EXISTS user_namespaces (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		cluster_id INTEGER NOT NULL,
		namespace TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY(cluster_id) REFERENCES k0s_clusters(id) ON DELETE CASCADE,
		UNIQUE(user_id, cluster_id, namespace)
	);
	`
	if _, err = DB.Exec(queryUserNamespaces); err != nil {
		return err
	}

	// Create cicd_registries table
	queryCicdRegistries := `
	CREATE TABLE IF NOT EXISTS cicd_registries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		url TEXT,
		username TEXT,
		password TEXT,
		ssl_enabled INTEGER NOT NULL DEFAULT 1,
		insecure_skip_verify INTEGER NOT NULL DEFAULT 0,
		extra_config TEXT,
		description TEXT,
		workspace_id TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err = DB.Exec(queryCicdRegistries); err != nil {
		return err
	}

	// Create cicd_workers table
	queryCicdWorkers := `
	CREATE TABLE IF NOT EXISTS cicd_workers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		host TEXT NOT NULL,
		ssh_port INTEGER NOT NULL DEFAULT 22,
		ssh_user TEXT NOT NULL DEFAULT 'root',
		ssh_private_key TEXT,
		agent_type TEXT NOT NULL DEFAULT 'shell',
		labels TEXT,
		description TEXT,
		workspace_id TEXT,
		status TEXT DEFAULT 'offline',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err = DB.Exec(queryCicdWorkers); err != nil {
		return err
	}

	// Create cicd_scan_reports table
	queryCicdScans := `
	CREATE TABLE IF NOT EXISTS cicd_scan_reports (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		scan_type TEXT NOT NULL,
		target TEXT NOT NULL,
		pipeline_id TEXT,
		pipeline_name TEXT,
		status TEXT NOT NULL DEFAULT 'clean',
		critical INTEGER NOT NULL DEFAULT 0,
		high INTEGER NOT NULL DEFAULT 0,
		medium INTEGER NOT NULL DEFAULT 0,
		low INTEGER NOT NULL DEFAULT 0,
		info INTEGER NOT NULL DEFAULT 0,
		summary TEXT,
		result_json TEXT,
		workspace_id TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err = DB.Exec(queryCicdScans); err != nil {
		return err
	}

	// Seed dummy scan reports if table is empty
	if err := seedScanReports(); err != nil {
		log.Printf("Warning: Failed to seed scan reports: %v", err)
	}

	// Migrate: add 'view' role to users table CHECK constraint
	// SQLite doesn't support modifying CHECK constraints, so we recreate the table
	err = migrateUsersRoleConstraint()
	if err != nil {
		log.Printf("Warning: Failed to migrate users role constraint: %v", err)
		// Continue anyway - table might already be migrated
	}

	// Insert default Local host if not exists
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM docker_hosts").Scan(&count); err == nil && count == 0 {
		// Detect default socket based on OS (simplified)
		defaultUri := "unix:///var/run/docker.sock"
		if os.Getenv("OS") == "Windows_NT" || os.PathSeparator == '\\' {
			defaultUri = "npipe:////./pipe/docker_engine"
		}

		_, err = DB.Exec("INSERT INTO docker_hosts (name, uri) VALUES (?, ?)", "Local", defaultUri)
		if err != nil {
			log.Printf("Failed to insert default host: %v", err)
		}
	}

	return nil
}

func LogActivity(action, target, status string) {
	if DB == nil {
		return
	}
	query := `INSERT INTO activity_logs (action, target, status) VALUES (?, ?, ?)`
	
	// Retry logic for database lock
	var err error
	for i := 0; i < 3; i++ {
		_, err = DB.Exec(query, action, target, status)
		if err == nil {
			return
		}
		if strings.Contains(err.Error(), "SQLITE_BUSY") || strings.Contains(err.Error(), "database is locked") {
			time.Sleep(time.Millisecond * 100 * time.Duration(i+1))
			continue
		}
		break
	}
	if err != nil {
		log.Printf("Failed to log activity after retries: %v", err)
	}
}

func GetActivityLogs() ([]models.ActivityLog, error) {
	rows, err := DB.Query("SELECT id, action, target, timestamp, status FROM activity_logs ORDER BY id DESC LIMIT 100")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.ActivityLog
	for rows.Next() {
		var logEntry models.ActivityLog
		if err := rows.Scan(&logEntry.ID, &logEntry.Action, &logEntry.Target, &logEntry.Timestamp, &logEntry.Status); err != nil {
			continue
		}
		logs = append(logs, logEntry)
	}
	return logs, nil
}

func GetSetting(key string) (string, error) {
	var value string
	err := DB.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

func SetSetting(key, value string) error {
	_, err := DB.Exec("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value)
	return err
}

// migrateUsersRoleConstraint updates the users table CHECK constraint to include all new roles
func migrateUsersRoleConstraint() error {
	// Check current CHECK constraint from schema
	var sql string
	err := DB.QueryRow("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").Scan(&sql)
	if err != nil {
		return err
	}

	// If table no longer uses CHECK constraint, we're done
	if !strings.Contains(sql, "CHECK") {
		log.Println("Users table already migrated (no CHECK constraint)")
		return nil
	}

	log.Println("Migrating users table: removing role CHECK constraint for multi-role support...")

	// Begin transaction
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Drop old backup if exists
	tx.Exec("DROP TABLE IF EXISTS users_old")

	// Rename current table
	if _, err := tx.Exec("ALTER TABLE users RENAME TO users_old"); err != nil {
		return fmt.Errorf("failed to rename old users table: %v", err)
	}

	// Create new table without CHECK constraint (supports comma-separated multi-roles)
	createSQL := `
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`
	if _, err := tx.Exec(createSQL); err != nil {
		return fmt.Errorf("failed to create new users table: %v", err)
	}

	// Copy all data from old table
	if _, err := tx.Exec(`
		INSERT INTO users (id, username, password, role, created_at)
		SELECT id, username, password, role, created_at FROM users_old
	`); err != nil {
		return fmt.Errorf("failed to copy users data: %v", err)
	}

	// Drop old table
	if _, err := tx.Exec("DROP TABLE users_old"); err != nil {
		return fmt.Errorf("failed to drop old users table: %v", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration: %v", err)
	}

	log.Println("Users table migration completed successfully")
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}

func seedScanReports() error {
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM cicd_scan_reports").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil // already seeded
	}

	type seed struct {
		scanType, target, pipelineName, status, summary, resultJSON string
		critical, high, medium, low, info                           int
	}

	seeds := []seed{
		// Trivy
		{
			scanType: "trivy", target: "myapp:1.2.0", pipelineName: "frontend-ci", status: "findings",
			summary:  "3 critical CVEs found in base image node:18-alpine",
			critical: 3, high: 7, medium: 12, low: 21, info: 4,
			resultJSON: `{"SchemaVersion":2,"ArtifactName":"myapp:1.2.0","Results":[{"Target":"myapp:1.2.0 (alpine 3.18.4)","Class":"os-pkgs","Type":"alpine","Vulnerabilities":[{"VulnerabilityID":"CVE-2023-5363","PkgName":"openssl","InstalledVersion":"3.1.3-r0","FixedVersion":"3.1.4-r0","Severity":"CRITICAL","Title":"Incorrect cipher key & IV length processing"},{"VulnerabilityID":"CVE-2023-5678","PkgName":"openssl","InstalledVersion":"3.1.3-r0","FixedVersion":"3.1.4-r0","Severity":"CRITICAL","Title":"Generating excessively long X9.42 DH keys"},{"VulnerabilityID":"CVE-2023-44487","PkgName":"nghttp2","InstalledVersion":"1.55.1-r0","FixedVersion":"1.57.0-r0","Severity":"CRITICAL","Title":"HTTP/2 Rapid Reset Attack"}]}]}`,
		},
		{
			scanType: "trivy", target: "backend-api:2.0.1", pipelineName: "backend-ci", status: "findings",
			summary:  "High severity vulnerabilities in golang.org/x/net",
			critical: 0, high: 4, medium: 6, low: 9, info: 2,
			resultJSON: `{"SchemaVersion":2,"ArtifactName":"backend-api:2.0.1","Results":[{"Target":"Go","Class":"lang-pkgs","Type":"gomod","Vulnerabilities":[{"VulnerabilityID":"CVE-2023-44487","PkgName":"golang.org/x/net","InstalledVersion":"0.10.0","FixedVersion":"0.17.0","Severity":"HIGH","Title":"HTTP/2 rapid reset can cause excessive work in net/http"},{"VulnerabilityID":"CVE-2023-39325","PkgName":"golang.org/x/net","InstalledVersion":"0.10.0","FixedVersion":"0.17.0","Severity":"HIGH","Title":"rapid stream resets can cause excessive work (CVE-2023-44487)"}]}]}`,
		},
		{
			scanType: "trivy", target: "nginx:1.25.3", pipelineName: "infra-deploy", status: "clean",
			summary: "No vulnerabilities found", critical: 0, high: 0, medium: 2, low: 5, info: 1,
			resultJSON: `{"SchemaVersion":2,"ArtifactName":"nginx:1.25.3","Results":[{"Target":"nginx:1.25.3 (debian 12.2)","Class":"os-pkgs","Type":"debian","Vulnerabilities":[]}]}`,
		},
		// SBOM
		{
			scanType: "sbom", target: "myapp:1.2.0", pipelineName: "frontend-ci", status: "clean",
			summary:  "SBOM generated: 312 components (npm), 0 license violations",
			critical: 0, high: 0, medium: 0, low: 0, info: 0,
			resultJSON: `{"bomFormat":"CycloneDX","specVersion":"1.4","serialNumber":"urn:uuid:a1b2c3d4-e5f6-7890-abcd-ef1234567890","version":1,"metadata":{"timestamp":"2026-02-20T10:00:00Z","tools":[{"vendor":"aquasecurity","name":"trivy","version":"0.47.0"}],"component":{"type":"container","name":"myapp","version":"1.2.0"}},"components":[{"type":"library","name":"react","version":"18.2.0","purl":"pkg:npm/react@18.2.0"},{"type":"library","name":"axios","version":"1.5.0","purl":"pkg:npm/axios@1.5.0"},{"type":"library","name":"lodash","version":"4.17.21","purl":"pkg:npm/lodash@4.17.21"}]}`,
		},
		{
			scanType: "sbom", target: "backend-api:2.0.1", pipelineName: "backend-ci", status: "findings",
			summary:  "SBOM generated: 87 Go modules — 2 with restrictive licenses (GPL-3.0)",
			critical: 0, high: 0, medium: 2, low: 0, info: 5,
			resultJSON: `{"bomFormat":"CycloneDX","specVersion":"1.4","serialNumber":"urn:uuid:b2c3d4e5-f6a7-8901-bcde-f12345678901","version":1,"metadata":{"timestamp":"2026-02-20T11:30:00Z","component":{"type":"container","name":"backend-api","version":"2.0.1"}},"components":[{"type":"library","name":"github.com/gorilla/mux","version":"v1.8.0","purl":"pkg:golang/github.com/gorilla/mux@v1.8.0","licenses":[{"license":{"id":"BSD-3-Clause"}}]},{"type":"library","name":"github.com/some/gpl-lib","version":"v1.0.0","purl":"pkg:golang/github.com/some/gpl-lib@v1.0.0","licenses":[{"license":{"id":"GPL-3.0"}}]}]}`,
		},
		// Gitleaks
		{
			scanType: "gitleaks", target: "github.com/org/frontend", pipelineName: "frontend-ci", status: "findings",
			summary:  "2 secrets detected: AWS key in .env.example, JWT secret in test config",
			critical: 2, high: 0, medium: 0, low: 0, info: 0,
			resultJSON: `[{"Description":"AWS Access Key","StartLine":12,"EndLine":12,"StartColumn":14,"EndColumn":34,"Match":"AKIAIOSFODNN7EXAMPLE","Secret":"AKIAIOSFODNN7EXAMPLE","File":".env.example","SymlinkFile":"","Commit":"a1b2c3d4","Entropy":3.8,"Author":"developer","Email":"dev@example.com","Date":"2026-02-15T08:30:00Z","Message":"add env example","Tags":["key"],"RuleID":"aws-access-key-id"},{"Description":"JWT Secret","StartLine":5,"EndLine":5,"StartColumn":18,"EndColumn":55,"Match":"my_super_secret_jwt_key_do_not_share","Secret":"my_super_secret_jwt_key_do_not_share","File":"config/test.yaml","Commit":"e5f6a7b8","Entropy":4.1,"Author":"developer","Email":"dev@example.com","Date":"2026-02-18T14:20:00Z","Message":"add test config","Tags":["secret"],"RuleID":"generic-api-key"}]`,
		},
		{
			scanType: "gitleaks", target: "github.com/org/backend", pipelineName: "backend-ci", status: "clean",
			summary:  "No secrets detected in repository history",
			critical: 0, high: 0, medium: 0, low: 0, info: 0,
			resultJSON: `[]`,
		},
		{
			scanType: "gitleaks", target: "github.com/org/infra", pipelineName: "infra-deploy", status: "findings",
			summary:  "1 private key found in legacy migration script",
			critical: 1, high: 0, medium: 0, low: 0, info: 0,
			resultJSON: `[{"Description":"RSA Private Key","StartLine":1,"EndLine":27,"StartColumn":1,"EndColumn":25,"Match":"-----BEGIN RSA PRIVATE KEY-----","Secret":"-----BEGIN RSA PRIVATE KEY-----\n...","File":"scripts/legacy/migrate.sh","Commit":"c3d4e5f6","Entropy":5.9,"Author":"infra-bot","Email":"infra@example.com","Date":"2025-11-01T09:00:00Z","Message":"old migration script","Tags":["key","private"],"RuleID":"private-key"}]`,
		},
		// Dependency Check
		{
			scanType: "dependency", target: "github.com/org/frontend", pipelineName: "frontend-ci", status: "findings",
			summary:  "5 vulnerable npm packages: lodash (prototype pollution), moment (ReDoS)",
			critical: 0, high: 2, medium: 3, low: 4, info: 1,
			resultJSON: `{"reportSchema":"1.1","scanInfo":{"engineVersion":"9.0.7","dataSource":"https://nvd.nist.gov"},"projectInfo":{"name":"frontend","reportDate":"2026-02-20T12:00:00Z","credits":"OWASP Dependency-Check"},"dependencies":[{"fileName":"lodash-4.17.20.tgz","filePath":"node_modules/lodash","description":"Lodash","packages":[{"id":"pkg:npm/lodash@4.17.20"}],"vulnerabilities":[{"name":"CVE-2021-23337","cvssv3":{"baseScore":7.2,"baseSeverity":"HIGH"},"description":"Lodash versions prior to 4.17.21 are vulnerable to Command Injection via the template function.","severity":"HIGH"}]},{"fileName":"moment-2.29.3.tgz","filePath":"node_modules/moment","vulnerabilities":[{"name":"CVE-2022-24785","cvssv3":{"baseScore":7.5,"baseSeverity":"HIGH"},"description":"A path traversal vulnerability impacts npm (server-side) users of Moment.js.","severity":"HIGH"}]}]}`,
		},
		{
			scanType: "dependency", target: "github.com/org/backend", pipelineName: "backend-ci", status: "clean",
			summary:  "All Go modules up to date — no known vulnerabilities",
			critical: 0, high: 0, medium: 0, low: 1, info: 3,
			resultJSON: `{"reportSchema":"1.1","scanInfo":{"engineVersion":"9.0.7"},"projectInfo":{"name":"backend-go","reportDate":"2026-02-20T13:00:00Z"},"dependencies":[{"fileName":"go.sum","vulnerabilities":[]}]}`,
		},
	}

	stmt, err := DB.Prepare(`INSERT INTO cicd_scan_reports
		(scan_type, target, pipeline_name, status, critical, high, medium, low, info, summary, result_json, workspace_id)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, s := range seeds {
		if _, err := stmt.Exec(s.scanType, s.target, s.pipelineName, s.status,
			s.critical, s.high, s.medium, s.low, s.info,
			s.summary, s.resultJSON, nil); err != nil {
			log.Printf("seed scan: %v", err)
		}
	}
	log.Println("Seeded dummy scan reports")
	return nil
}
