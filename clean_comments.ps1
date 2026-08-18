# CSS Comment Cleaner Script
# Keeps only structural section comments (/* ===== SECTION ===== */)
# Removes inline explanatory and instructional comments

$inputFile = "style.css"
$outputFile = "style_cleaned.css"
$backupFile = "style_backup.css"

# Create backup
Copy-Item $inputFile $backupFile -Force
Write-Host "Backup created: $backupFile"

# Read file
$content = Get-Content $inputFile -Raw

# Keep track of what we're removing (for reporting)
$removedCount = 0

# Pattern 1: Remove single-line comments that are NOT section headers
# Section headers look like: /* ===== SECTION NAME ===== */
$content = $content -replace '(?m)^\s*/\*(?!\s*=====).*?\*/\s*$', '' 
$removedCount++

# Pattern 2: Remove inline comments like /* comment */
$content = $content -replace '/\*(?!\s*=====)[^*]*\*/', ''

# Pattern 3: Clean up multi-line comments that are not section headers
# This is trickier - let's keep it simple and target common patterns
$content = $content -replace '(?s)/\*(?!\s*=====).*?\*/', ''

# Clean up excessive blank lines (more than 2 consecutive)
$content = $content -replace '(\r?\n){4,}', "`r`n`r`n`r`n"

# Save cleaned file
$content | Set-Content $outputFile -NoNewline

Write-Host "Cleaned CSS saved to: $outputFile"
Write-Host "Original preserved as: $backupFile"
Write-Host "Review $outputFile and if satisfied, rename it to style.css"
