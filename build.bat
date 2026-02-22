@echo off
echo Building Docker Manager...

go build -o docker-manager.exe ./cmd/server
if %ERRORLEVEL% EQU 0 (
    echo Build success!
    echo You can now run docker-manager.exe
) else (
    echo Build failed.
)
pause
