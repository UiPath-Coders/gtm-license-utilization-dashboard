param(
  [ValidateSet('Prepare','Execute')]
  [string]$Stage = 'Prepare'
)

$ErrorActionPreference = 'Stop'
$entityId = '146eb717-2895-f111-9b33-7c1e521513a8'
$sourceCsv = 'C:\Users\logesh.velu\Downloads\Temporary_2026-08-12-0835.csv'
$migrationDir = Join-Path $PSScriptRoot 'CompleteLicenseUtilization.migration'
New-Item -ItemType Directory -Force -Path $migrationDir | Out-Null

function Invoke-UipJson([string[]]$Arguments) {
  $raw = & uip @Arguments --output json --log-level error
  if ($LASTEXITCODE -ne 0) { throw "uip failed: $($Arguments -join ' ')" }
  return ($raw | ConvertFrom-Json)
}

function Get-AllRecords {
  $all = [System.Collections.Generic.List[object]]::new()
  $cursor = $null
  do {
    $args = @('df','records','query',$entityId,'--limit','1000')
    if ($cursor) { $args += @('--cursor',$cursor) }
    $page = Invoke-UipJson $args
    foreach ($item in $page.Data.Items) { $all.Add($item) }
    $cursor = if ($page.Data.HasNextPage) { $page.Data.NextCursor.Value } else { $null }
  } while ($cursor)
  return $all
}

if ($Stage -eq 'Prepare') {
  $current = Get-AllRecords
  $current | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $migrationDir 'backup-current-records-2026-08-12.json') -Encoding utf8

  $records = foreach ($row in (Import-Csv -LiteralPath $sourceCsv)) {
    $utilization = if ([string]::IsNullOrWhiteSpace($row.UTILIZATION_PERCENT)) { $null } else { [decimal]$row.UTILIZATION_PERCENT }
    [ordered]@{
      RecordKey = "$($row.CUSTOMER_NAME)|$($row.LICENSECODE)|$($row.LICENSE_CATEGORY)|$($row.AS_OF_DATE)"
      CustomerName = $row.CUSTOMER_NAME
      LicenseCode = $row.LICENSECODE
      LicenseCategory = $row.LICENSE_CATEGORY
      AsOfDate = $row.AS_OF_DATE
      PurchasedUnits = [decimal]$row.PURCHASED_UNITS
      UtilizedUnits = [decimal]$row.UTILIZED_UNITS
      UtilizationPercent = $utilization
      CustomerGeo = $row.CUSTOMER_GEO
      CustomerRegion = $row.CUSTOMER_REGION
      CustomerArea = $row.CUSTOMER_AREA
      CurrentContractEndDate = $row.CURRENT_CONTRACT_END_DATE
    }
  }

  $records | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $migrationDir 'replacement-records.json') -Encoding utf8
  $records[0..499] | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $migrationDir 'replacement-batch-1.json') -Encoding utf8
  $records[500..($records.Count - 1)] | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $migrationDir 'replacement-batch-2.json') -Encoding utf8
  [ordered]@{ BackupCount=$current.Count; ReplacementCount=$records.Count; Batch1=500; Batch2=$records.Count-500 } | ConvertTo-Json
  exit 0
}

$schemaUpdate = '{"addFields":[{"fieldName":"CustomerRegion","type":"STRING","lengthLimit":100,"isRequired":true,"displayName":"Customer Region","description":"Customer sales region, such as AMER FINS Northeast or AMER FINS West."},{"fieldName":"CurrentContractEndDate","type":"DATE","isRequired":true,"displayName":"Current Contract End Date","description":"Current license contract end date."}]}'
Invoke-UipJson @('df','entities','update',$entityId,'--body',$schemaUpdate,'--yes','--reason','Add region and contract end date columns for the 2026-08-12 utilization dataset') | Out-Null

$currentRecords = Get-AllRecords
$ids = @($currentRecords | ForEach-Object { $_.Id })
for ($i = 0; $i -lt $ids.Count; $i += 200) {
  $end = [Math]::Min($i + 199, $ids.Count - 1)
  $chunk = @($ids[$i..$end])
  Invoke-UipJson (@('df','records','delete',$entityId) + $chunk + @('--yes','--reason','Replace dataset with Temporary_2026-08-12-0835.csv')) | Out-Null
}

$batch1 = Join-Path $migrationDir 'replacement-batch-1.json'
$batch2 = Join-Path $migrationDir 'replacement-batch-2.json'
$insert1 = Invoke-UipJson @('df','records','insert',$entityId,'--file',$batch1)
$insert2 = Invoke-UipJson @('df','records','insert',$entityId,'--file',$batch2)

$verify = Invoke-UipJson @('df','records','query',$entityId,'--limit','1')
[ordered]@{
  Deleted = $ids.Count
  Batch1Success = $insert1.Data.SuccessCount
  Batch1Failure = $insert1.Data.FailureCount
  Batch2Success = $insert2.Data.SuccessCount
  Batch2Failure = $insert2.Data.FailureCount
  FinalCount = $verify.Data.TotalCount
} | ConvertTo-Json
