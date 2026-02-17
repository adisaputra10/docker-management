package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

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

	// Enable WAL mode for better concurrency
	if _, err := DB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		log.Printf("Warning: Failed to enable WAL mode: %v", err)
	}

	// Create activity_logs table
	query := `
	CREATE TABLE IF NOT EXISTS activity_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		action TEXT NOT NULL,
		target TEXT NOT NULL,
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
	_, err := DB.Exec(query, action, target, status)
	if err != nil {
		log.Printf("Failed to log activity: %v", err)
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

func Close() {
	if DB != nil {
		DB.Close()
	}
}
