param([switch]$SoloPreparar)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Instala .NET SDK 10 antes de iniciar FarmaControl.' }
$localDbCommand = Get-Command SqlLocalDB.exe -ErrorAction SilentlyContinue
if ($localDbCommand) { $localDbExecutable = $localDbCommand.Source }
else {
    $localDbExecutable = Get-ChildItem -LiteralPath 'C:\Program Files\Microsoft SQL Server' -Filter SqlLocalDB.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $localDbExecutable) { throw 'Instala SQL Server Express LocalDB. El README explica los requisitos.' }
$instances = & $localDbExecutable info
if ($instances -notcontains 'FarmaControlAvance80') {
    & $localDbExecutable create FarmaControlAvance80
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la instancia de SQL Server.' }
}
& $localDbExecutable start FarmaControlAvance80
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar SQL Server LocalDB.' }
if (-not $SoloPreparar) {
    try {
        $health = Invoke-RestMethod -Uri 'http://localhost:5188/health' -TimeoutSec 2
        if ($health.application -eq 'FarmaControl' -and $health.connected) {
            Start-Process 'http://localhost:5188'
            Write-Host 'FarmaControl ya esta funcionando en http://localhost:5188'
            exit 0
        }
    } catch {}
}
dotnet restore FarmaControl.csproj
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron restaurar las dependencias. Revisa la conexion a Internet.' }
dotnet build FarmaControl.csproj --configuration Release --no-restore
if ($LASTEXITCODE -ne 0) { throw 'La compilacion no termino correctamente.' }
dotnet run --project FarmaControl.csproj --configuration Release --no-build -- --init
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la base de datos.' }
if ($SoloPreparar) { Write-Host 'Proyecto compilado y base de datos preparada.'; exit 0 }
Start-Job -ScriptBlock {
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        try {
            $status = Invoke-RestMethod -Uri 'http://localhost:5188/health' -TimeoutSec 1
            if ($status.connected) { Start-Process 'http://localhost:5188'; break }
        } catch {}
        Start-Sleep -Seconds 1
    }
} | Out-Null
Write-Host 'Mantiene esta ventana abierta. Para detener el sistema, pulsa Ctrl+C.'
dotnet run --project FarmaControl.csproj --configuration Release --no-build --no-launch-profile --urls http://localhost:5188
