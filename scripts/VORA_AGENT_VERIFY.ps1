# Run locally before creating any Git commit or deploying VORA Virtual Agent.
# All verification output is copied to the Windows clipboard automatically.
$report = & {
    $ErrorActionPreference = 'Stop'
    try {
        '=== VORA VIRTUAL AGENT: RELEASE CHECK ==='
        $repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
        $logdir = Join-Path $env:TEMP 'vora-agent-verification'
        New-Item -ItemType Directory -Path $logdir -Force | Out-Null

        function Check {
            param([string]$Name, [string]$Command, [string]$Label)
            "`n[$Name]"
            $stdout = Join-Path $logdir "$Label.stdout.log"
            $stderr = Join-Path $logdir "$Label.stderr.log"
            $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d','/c',$Command) `
                -WorkingDirectory $repo -Wait -PassThru -NoNewWindow `
                -RedirectStandardOutput $stdout -RedirectStandardError $stderr
            "EXIT CODE: $($proc.ExitCode)"
            if ($proc.ExitCode -eq 0) {
                'RESULT: PASS'
                if ($Label -eq 'build') { Get-Content -LiteralPath $stdout -Tail 18 }
            } else {
                'RESULT: FAIL'
                'OUTPUT:'
                Get-Content -LiteralPath $stdout -Tail 45 -ErrorAction SilentlyContinue
                Get-Content -LiteralPath $stderr -Tail 25 -ErrorAction SilentlyContinue
                throw "$Name failed. No commit or push performed."
            }
            "LOGS: $stdout"
        }

        "`n[1] REPOSITORY"
        if (!(Test-Path -LiteralPath (Join-Path $repo 'package-lock.json'))) { throw 'package-lock.json not found' }
        if (!(Test-Path -LiteralPath (Join-Path $repo 'public\static\assets\vora-agent-profile.png'))) { throw 'VORA Agent portrait missing' }
        if (!(Test-Path -LiteralPath (Join-Path $repo 'migrations\0036_agent_logistics_special_cargo.sql'))) { throw 'SQL migration 0036 missing' }
        "ROOT: $repo"
        "NODE: $(node --version)"
        "NPM: $(npm --version)"
        if (Test-Path -LiteralPath (Join-Path $repo '.git')) { "HEAD: $(git -C $repo rev-parse --short HEAD)" }

        Check -Name '2 - INSTALL LOCKED DEPENDENCIES' -Command 'npm ci --no-audit --no-fund' -Label 'install'
        Check -Name '3 - APPLICATION TYPESCRIPT' -Command 'node node_modules\typescript\bin\tsc --noEmit -p tsconfig.json --pretty false --incremental false' -Label 'ts-app'
        Check -Name '4 - TESTS TYPESCRIPT' -Command 'node node_modules\typescript\bin\tsc --noEmit -p tsconfig.tests.json --pretty false --incremental false' -Label 'ts-tests'
        Check -Name '5 - AGENT UNIT TESTS' -Command 'node_modules\.bin\vitest.cmd run -c vitest.unit.config.ts tests/unit/agent-freight-safety.test.ts tests/unit/agent.test.ts tests/unit/agent-knowledge.test.ts' -Label 'agent-tests'
        Check -Name '6 - COMPLETE SETUP SQL' -Command 'node_modules\.bin\tsx.cmd scripts/build-manual-setup.ts --check' -Label 'setup-sql'
        Check -Name '7 - NEXT.JS PRODUCTION BUILD' -Command 'npm run build' -Label 'build'
        "`n=== ALL RELEASE CHECKS PASSED ==="
        'SOURCE IS READY FOR CODE REVIEW AND COMMIT.'
        'NO COMMIT, PUSH OR DATABASE CHANGES PERFORMED.'
    } catch {
        "ERROR: $($_.Exception.Message)"
        '=== RELEASE CHECK FAILED OR INCOMPLETE ==='
        'NO COMMIT OR PUSH PERFORMED.'
    }
} | Out-String -Width 240
$report = $report.TrimEnd()
Set-Clipboard -Value $report
Write-Output $report
Write-Host "`nOUTPUT COPIED TO CLIPBOARD. CTRL+V IN CHATGPT." -ForegroundColor Green
