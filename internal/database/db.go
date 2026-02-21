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
		role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
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

// migrateUsersRoleConstraint updates the users table CHECK constraint to include 'view' role
func migrateUsersRoleConstraint() error {
	// Check if users_new table already exists (indicates migration already done)
	var tableExists string
	err := DB.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='users_new'").Scan(&tableExists)
	if err == nil {
		// Migration already done, just drop the old backup
		DB.Exec("DROP TABLE IF EXISTS users_old")
		// Rename users_new to users if needed
		if tableExists == "users_new" {
			DB.Exec("DROP TABLE IF EXISTS users")
			DB.Exec("ALTER TABLE users_new RENAME TO users")
		}
		return nil
	}

	// Check current CHECK constraint
	var sql string
	err = DB.QueryRow("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").Scan(&sql)
	if err != nil {
		return err
	}

	// If constraint already includes 'view', we're done
	if strings.Contains(sql, "'admin', 'user', 'view'") || strings.Contains(sql, "'view', 'user', 'admin'") {
		return nil
	}

	// Begin transaction
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Rename old table
	if _, err := tx.Exec("ALTER TABLE users RENAME TO users_old"); err != nil {
		return err
	}

	// Create new table with updated constraint
	if _, err := tx.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'view')),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`); err != nil {
		return err
	}

	// Copy data
	if _, err := tx.Exec(`
		INSERT INTO users (id, username, password, role, created_at)
		SELECT id, username, password, role, created_at FROM users_old
	`); err != nil {
		return err
	}

	// Drop old table
	if _, err := tx.Exec("DROP TABLE users_old"); err != nil {
		return err
	}

	// Commit transaction
	return tx.Commit()
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
