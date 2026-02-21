# Script to check k0s deployment status
$sshHost = "root@192.168.56.111"
$cmd1 = "sudo k0s kubectl get deployment -n testing"
$cmd2 = "sudo k0s kubectl get pods -n testing"
$cmd3 = "sudo k0s kubectl get pods -n testing -o wide"
$cmd4 = "sudo k0s kubectl describe deployment nginx -n testing"

Write-Host "=== Checking k0s Cluster ===" -ForegroundColor Cyan

Write-Host "`n>>> DEPLOYMENTS in testing namespace:" -ForegroundColor Yellow
$result1 = ssh -o StrictHostKeyChecking=no $sshHost $cmd1 2>&1
Write-Host $result1

Write-Host "`n>>> PODS in testing namespace:" -ForegroundColor Yellow
$result2 = ssh -o StrictHostKeyChecking=no $sshHost $cmd2 2>&1
Write-Host $result2

Write-Host "`n>>> PODS (wide format):" -ForegroundColor Yellow
$result3 = ssh -o StrictHostKeyChecking=no $sshHost $cmd3 2>&1
Write-Host $result3

Write-Host "`n>>> DEPLOYMENT DESCRIPTION:" -ForegroundColor Yellow
$result4 = ssh -o StrictHostKeyChecking=no $sshHost $cmd4 2>&1
Write-Host $result4
