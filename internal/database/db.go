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

func Close() {
	if DB != nil {
		DB.Close()
	}
}
