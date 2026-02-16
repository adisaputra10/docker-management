package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/adisaputra10/docker-management/internal/database"
	"github.com/docker/docker/api/types/container"
)

// ChatRequest represents the incoming chat message
type ChatRequest struct {
	Message string `json:"message"`
}

// SettingsRequest represents the AI settings
type SettingsRequest struct {
	ApiKey  string `json:"apiKey"`
	Model   string `json:"model"`
	BaseURL string `json:"baseUrl"`
}

// OpenAIRequest structure
type OpenAIRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenAIResponse structure
type OpenAIResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

// Handle Chat
func handleChat(w http.ResponseWriter, r *http.Request) {
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// 1. Get AI Settings
	apiKey, _ := database.GetSetting("openai_api_key")
	model, _ := database.GetSetting("openai_model")
	baseURL, _ := database.GetSetting("openai_base_url")

	if apiKey == "" {
		apiKey = "sk-placeholder" // Allow some local LLMs that assume dummy key
	}
	if model == "" {
		model = "gpt-3.5-turbo"
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	// Normalization
	baseURL = strings.TrimSuffix(baseURL, "/")

	// 2. Gather Docker Context (Containers status)
	cli, err := GetClient(r)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get docker client: %v", err), http.StatusInternalServerError)
		return
	}

	containers, err := cli.ContainerList(context.Background(), container.ListOptions{All: true})
	var contextStr strings.Builder
	contextStr.WriteString("Current Docker Containers Status:\n")

	if err == nil {
		for _, c := range containers {
			status := c.Status
			state := c.State
			name := "unknown"
			if len(c.Names) > 0 {
				name = strings.TrimPrefix(c.Names[0], "/")
			}
			contextStr.WriteString(fmt.Sprintf("- Name: %s, ID: %s, State: %s (%s), Image: %s\n", name, c.ID[:12], state, status, c.Image))

			// If container is not running, try to fetch last 20 lines of logs
			if state != "running" {
				logs, err := cli.ContainerLogs(context.Background(), c.ID, container.LogsOptions{
					ShowStdout: true,
					ShowStderr: true,
					Tail:       "20",
				})
				if err == nil {
					defer logs.Close()
					logContent, _ := io.ReadAll(logs)
					if len(logContent) > 0 {
						// Filter control characters? Simplified for now
						contextStr.WriteString(fmt.Sprintf("  Logs (last 20 lines):\n%s\n", string(logContent)))
					}
				}
			}
		}
	} else {
		contextStr.WriteString(fmt.Sprintf("Error listing containers: %v\n", err))
	}

	// 3. Construct System Prompt
	systemPrompt := fmt.Sprintf(`You are a Docker troubleshooting assistant. 
You are connected to a Docker environment. Here is the current state of containers:
%s

Analyze the situation. If a container is failing, use the provided logs to explain why. 
Provide concise, actionable CLI commands or explanations.`, contextStr.String())

	// 4. Call OpenAI API
	openAIReq := OpenAIRequest{
		Model: model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: req.Message},
		},
	}

	reqBody, _ := json.Marshal(openAIReq)
	apiReq, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	apiReq.Header.Set("Content-Type", "application/json")
	apiReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(apiReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to contact AI provider: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		http.Error(w, fmt.Sprintf("AI Provider Error: %s", string(bodyBytes)), resp.StatusCode)
		return
	}

	var openAIResp OpenAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		http.Error(w, "Failed to parse AI response", http.StatusInternalServerError)
		return
	}

	if len(openAIResp.Choices) == 0 {
		http.Error(w, "No response from AI", http.StatusInternalServerError)
		return
	}

	// Return the answer
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"reply": openAIResp.Choices[0].Message.Content,
	})
}

// Get Settings
func getSettings(w http.ResponseWriter, r *http.Request) {
	apiKey, _ := database.GetSetting("openai_api_key")
	model, _ := database.GetSetting("openai_model")
	baseURL, _ := database.GetSetting("openai_base_url")

	// Don't return actual API key for security, just mask it?
	// Or simplistic approach: return it if user needs to edit.
	// We'll return masked.
	maskedKey := ""
	if len(apiKey) > 4 {
		maskedKey = "..." + apiKey[len(apiKey)-4:]
	}

	json.NewEncoder(w).Encode(map[string]string{
		"apiKey":  maskedKey, // Only show trailing chars
		"model":   model,
		"baseUrl": baseURL,
	})
}

// Save Settings
func saveSettings(w http.ResponseWriter, r *http.Request) {
	var req SettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// Only update if provided
	if req.ApiKey != "" && !strings.HasPrefix(req.ApiKey, "...") {
		database.SetSetting("openai_api_key", req.ApiKey)
	}
	if req.Model != "" {
		database.SetSetting("openai_model", req.Model)
	}
	if req.BaseURL != "" {
		database.SetSetting("openai_base_url", req.BaseURL)
	}

	w.WriteHeader(http.StatusOK)
}
