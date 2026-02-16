package api

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types/container"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

func execContainer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	containerID := vars["id"]

	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Create exec configuration
	execConfig := container.ExecOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Cmd:          []string{"/bin/sh"}, // Try /bin/sh first
	}

	// Try /bin/bash if /bin/sh fails
	// Note: Creating Exec does not fail if shell not found, logic implies successful creation but maybe failed start?
	// But usually we just pick one.
	// The original code tries /bin/sh, then /bin/bash?
	// Actually ContainerExecCreate doesn't validate Cmd existence.
	// We'll stick to original logic: try sh, if create fails (unlikely), try bash.
	execID, err := cli.ContainerExecCreate(context.Background(), containerID, execConfig)
	if err != nil {
		// Try with bash
		execConfig.Cmd = []string{"/bin/bash"}
		execID, err = cli.ContainerExecCreate(context.Background(), containerID, execConfig)
		if err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error creating exec: %v\r\n", err)))
			database.LogActivity("exec_container", containerID, "error")
			return
		}
	}

	// Attach to exec
	hijackedResp, err := cli.ContainerExecAttach(context.Background(), execID.ID, container.ExecStartOptions{
		Tty: true,
	})
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error attaching to exec: %v\r\n", err)))
		database.LogActivity("exec_container", containerID, "error")
		return
	}
	defer hijackedResp.Close()

	database.LogActivity("exec_container", containerID, "success")

	// Send welcome message
	conn.WriteMessage(websocket.TextMessage, []byte("Connected to container terminal...\r\n"))

	// Channel for errors
	errChan := make(chan error, 2)

	// Goroutine: Read from Docker and write to WebSocket
	go func() {
		buffer := make([]byte, 4096)
		for {
			n, err := hijackedResp.Reader.Read(buffer)
			if err != nil {
				if err != io.EOF {
					errChan <- fmt.Errorf("read from docker: %v", err)
				} else {
					errChan <- nil
				}
				return
			}
			if n > 0 {
				err = conn.WriteMessage(websocket.TextMessage, buffer[:n])
				if err != nil {
					errChan <- fmt.Errorf("write to websocket: %v", err)
					return
				}
			}
		}
	}()

	// Goroutine: Read from WebSocket and write to Docker
	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					errChan <- fmt.Errorf("read from websocket: %v", err)
				} else {
					errChan <- nil
				}
				return
			}
			_, err = hijackedResp.Conn.Write(message)
			if err != nil {
				errChan <- fmt.Errorf("write to docker: %v", err)
				return
			}
		}
	}()

	// Wait for error or completion
	execErr := <-errChan
	log.Printf("Exec session ended: %v", execErr)
}
