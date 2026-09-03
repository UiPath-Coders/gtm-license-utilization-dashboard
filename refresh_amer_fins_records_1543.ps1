param([ValidateSet('Prepare','Execute')][string]$Stage = 'Prepare')

$ErrorActionPreference = 'Stop'
$rollupEntityId = '1898909b-a699-f111-9b33-7c1e521513a8'
$detailEntityId = '5e1ff6a4-a699-f111-9b33-7c1e521513a8'
$rollupCsv = 'C:\Users\logesh.velu\Downloads\AMER FINS — Active Customer Account Rollup Temp_2026-08-20-2252.csv'
$detailCsv = 'C:\Users\logesh.velu\Downloads\AMER FINS — Active License Key Detail Temp_2026-08-20-2242.csv'
$workDir = Join-Path $PSScriptRoot 'AmerFinsDataFabricMigration'
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

function Invoke-UipJson([string[]]$Arguments) {
  $raw = & uip @Arguments --output json --log-level error
  if ($LASTEXITCODE -ne 0) { throw "uip failed: $($Arguments -join ' ')`n$raw" }
  return ($raw | ConvertFrom-Json)
}

function Get-AllRecords([string]$EntityId) {
  $all = [System.Collections.Generic.List[object]]::new()
  $cursor = $null
  do {
    $args = @('df','records','query',$EntityId,'--limit','1000')
    if ($cursor) { $args += @('--cursor',$cursor) }
    $page = Invoke-UipJson $args
    foreach ($item in $page.Data.Items) { $all.Add($item) }
    $cursor = if ($page.Data.HasNextPage) { $page.Data.NextCursor.Value } else { $null }
  } while ($cursor)
  return $all
}

function Decimal-OrNull([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  return [decimal]$Value
}

function Delete-InBatches([string]$EntityId, [object[]]$Records, [string]$Reason) {
  $success = 0
  for ($i = 0; $i -lt $Records.Count; $i += 100) {
    $end = [Math]::Min($i + 99, $Records.Count - 1)
    $ids = @($Records[$i..$end] | ForEach-Object { [string]$_.Id })
    $result = Invoke-UipJson (@('df','records','delete',$EntityId) + $ids + @('--yes','--reason',$Reason))
    $success += [int]$result.Data.SuccessCount
    if ([int]$result.Data.FailureCount -ne 0) { throw "Record delete failures: $($result.Data.FailureCount)" }
  }
  return $success
}

function Insert-InBatches([string]$EntityId, [object[]]$Records, [string]$Prefix) {
  $success = 0
  for ($i = 0; $i -lt $Records.Count; $i += 200) {
    $end = [Math]::Min($i + 199, $Records.Count - 1)
    $path = Join-Path $workDir "$Prefix-$([int]($i / 200) + 1).json"
    @($Records[$i..$end]) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $path -Encoding utf8
    $result = Invoke-UipJson @('df','records','insert',$EntityId,'--file',$path)
    $success += [int]$result.Data.SuccessCount
    if ([int]$result.Data.FailureCount -ne 0) { throw "Record insert failures: $($result.Data.FailureCount)" }
  }
  return $success
}

$rollupRows = @(Import-Csv -LiteralPath $rollupCsv)
$detailRows = @(Import-Csv -LiteralPath $detailCsv)
$duplicateCustomers = @($rollupRows | Group-Object CUSTOMER_ID | Where-Object Count -gt 1)
$duplicateDetails = @($detailRows | Group-Object CUSTOMER_ID,LICENSECODE,LICENSE_CATEGORY,AS_OF_DATE | Where-Object Count -gt 1)
$rollupIds = @($rollupRows.CUSTOMER_ID | Sort-Object -Unique)
$detailIds = @($detailRows.CUSTOMER_ID | Sort-Object -Unique)
$unmatched = @($detailIds | Where-Object { $_ -notin $rollupIds })

if ($duplicateCustomers.Count -or $duplicateDetails.Count -or $unmatched.Count) {
  throw "Preflight failed: duplicate customers=$($duplicateCustomers.Count), duplicate detail keys=$($duplicateDetails.Count), unmatched customers=$($unmatched.Count)"
}

if ($Stage -eq 'Prepare') {
  [pscustomobject]@{
    RollupRows=$rollupRows.Count; DetailRows=$detailRows.Count; UniqueCustomers=$rollupIds.Count
    DuplicateCustomers=$duplicateCustomers.Count; DuplicateDetailKeys=$duplicateDetails.Count; UnmatchedCustomers=$unmatched.Count
  } | ConvertTo-Json
  exit 0
}

$oldRollupRecords = Get-AllRecords $rollupEntityId
$oldDetailRecords = Get-AllRecords $detailEntityId
$oldRollupRecords | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $workDir 'AmerFinsActiveCustomerAccountRollup-backup-before-20260820.json') -Encoding utf8
$oldDetailRecords | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $workDir 'AmerFinsActiveLicenseKeyDetail-backup-before-20260820.json') -Encoding utf8

# Delete children first so no relationship points at a deleted parent record.
$detailDeleted = Delete-InBatches $detailEntityId $oldDetailRecords 'Replace with approved 2026-08-20 active license detail CSV'
$rollupDeleted = Delete-InBatches $rollupEntityId $oldRollupRecords 'Replace with approved 2026-08-20 customer rollup CSV'

$rollupSchema = Invoke-UipJson @('df','entities','get',$rollupEntityId)
$parentField = @($rollupSchema.Data.Fields | Where-Object Name -eq 'ParentCompanyName')
if (-not $parentField.Count) {
  $body = @{addFields=@(@{fieldName='ParentCompanyName';type='STRING';lengthLimit=255;isRequired=$true;displayName='Parent Company Name';description='Ultimate or reporting parent company for the customer account.'})} | ConvertTo-Json -Depth 5 -Compress
  $null = Invoke-UipJson @('df','entities','update',$rollupEntityId,'--body',$body,'--yes','--reason','Add approved Parent Company Name column from 15:43 rollup CSV')
}

$detailSchema = Invoke-UipJson @('df','entities','get',$detailEntityId)
$newDetailFields = @()
if (-not @($detailSchema.Data.Fields | Where-Object Name -eq 'LicenseType').Count) { $newDetailFields += @{fieldName='LicenseType';type='STRING';lengthLimit=100;isRequired=$false;displayName='License Type'} }
if (-not @($detailSchema.Data.Fields | Where-Object Name -eq 'RobotBoughtHoursMonthly').Count) { $newDetailFields += @{fieldName='RobotBoughtHoursMonthly';type='DECIMAL';precision=18;scale=4;isRequired=$false;displayName='Robot Bought Hours Monthly'} }
if (-not @($detailSchema.Data.Fields | Where-Object Name -eq 'RobotExecutionHoursMonthly').Count) { $newDetailFields += @{fieldName='RobotExecutionHoursMonthly';type='DECIMAL';precision=18;scale=4;isRequired=$false;displayName='Robot Execution Hours Monthly'} }
if (-not @($detailSchema.Data.Fields | Where-Object Name -eq 'RobotMonthlyExecutionPercent').Count) { $newDetailFields += @{fieldName='RobotMonthlyExecutionPercent';type='DECIMAL';precision=18;scale=4;isRequired=$false;displayName='Robot Monthly Execution Percent'} }
if ($newDetailFields.Count) {
  $body = @{addFields=$newDetailFields} | ConvertTo-Json -Depth 5 -Compress
  $null = Invoke-UipJson @('df','entities','update',$detailEntityId,'--body',$body,'--yes','--reason','Add approved 2026-08-20 license type and robot utilization fields')
}

$rollupRecords = @($rollupRows | ForEach-Object {
  [ordered]@{
    CustomerName=$_.CUSTOMER_NAME; ParentCompanyName=$_.PARENT_COMPANY_NAME; ActiveLicenseKeyCount=[decimal]$_.ACTIVE_LICENSE_KEY_COUNT; LatestAsOfDate=$_.LATEST_AS_OF_DATE
    UnattendedProdPurchased=[decimal]$_.UNATTENDED_PROD_ALLOCATED; UnattendedProdUtilized=[decimal]$_.UNATTENDED_PROD_UTILIZED; UnattendedProdUtilizationPercent=(Decimal-OrNull $_.UNATTENDED_PROD_UTILIZATION_PERCENT)
    TestRobotPurchased=[decimal]$_.TEST_ROBOT_ALLOCATED; TestRobotUtilized=[decimal]$_.TEST_ROBOT_UTILIZED; TestRobotUtilizationPercent=(Decimal-OrNull $_.TEST_ROBOT_UTILIZATION_PERCENT)
    UserLicensePurchased=[decimal]$_.USER_LICENSE_ALLOCATED; UserLicenseUtilized=[decimal]$_.USER_LICENSE_UTILIZED; UserLicenseUtilizationPercent=(Decimal-OrNull $_.USER_LICENSE_UTILIZATION_PERCENT)
    AiUnitsPurchased=[decimal]$_.AI_UNITS_ALLOCATED; AiUnitsUtilized=[decimal]$_.AI_UNITS_UTILIZED; AiUnitsUtilizationPercent=(Decimal-OrNull $_.AI_UNITS_UTILIZATION_PERCENT)
    AgentUnitsPurchased=[decimal]$_.AGENT_UNITS_ALLOCATED; AgentUnitsUtilized=[decimal]$_.AGENT_UNITS_UTILIZED; AgentUnitsUtilizationPercent=(Decimal-OrNull $_.AGENT_UNITS_UTILIZATION_PERCENT)
    PlatformUnitsPurchased=[decimal]$_.PLATFORM_UNITS_ALLOCATED; PlatformUnitsUtilized=[decimal]$_.PLATFORM_UNITS_UTILIZED; PlatformUnitsUtilizationPercent=(Decimal-OrNull $_.PLATFORM_UNITS_UTILIZATION_PERCENT)
    OtherUnmappedPurchasedUnits=0; UtilizationWithoutMatchedPurchaseRows=0
    DeploymentType=$_.DEPLOYMENT_TYPE; CustomerGeo=$_.CUSTOMER_GEO; CustomerRegion=$_.CUSTOMER_REGION; CustomerArea=$_.CUSTOMER_AREA
    EarliestActiveContractEndDate=$_.EARLIEST_ACTIVE_CONTRACT_END_DATE; LatestActiveContractEndDate=$_.LATEST_ACTIVE_CONTRACT_END_DATE
    AccountOwnerName=$_.ACCOUNT_OWNER_NAME; CsdName=$_.CSD_NAME; CustomerSuccessManagerName=$_.CUSTOMER_SUCCESS_MANAGER_NAME; TamName=$_.TAM_NAME
    CustomerSupportPackage=$_.CUSTOMER_SUPPORT_PACKAGE; CustomerId=$_.CUSTOMER_ID
  }
})
$rollupInserted = Insert-InBatches $rollupEntityId $rollupRecords 'rollup-1543-batch'

$parentRecords = Get-AllRecords $rollupEntityId
$customerRecordIds = @{}
foreach ($record in $parentRecords) { $customerRecordIds[[string]$record.CustomerId] = [string]$record.Id }

$detailRecords = @($detailRows | ForEach-Object {
  [ordered]@{
    RecordKey="$($_.CUSTOMER_ID)|$($_.LICENSECODE)|$($_.LICENSE_CATEGORY)|$($_.AS_OF_DATE)"
    CustomerName=$_.CUSTOMER_NAME; LicenseCode=$_.LICENSECODE; LicenseType=$_.LICENSE_TYPE; DeploymentType=$_.DEPLOYMENT_TYPE; LicenseCategory=$_.LICENSE_CATEGORY; AsOfDate=$_.AS_OF_DATE
    PurchasedUnits=[decimal]$_.ALLOCATED_UNITS; UtilizedUnits=(Decimal-OrNull $_.UTILIZED_UNITS); UtilizationPercent=(Decimal-OrNull $_.UTILIZATION_PERCENT)
    RobotBoughtHoursMonthly=(Decimal-OrNull $_.ROBOT_BOUGHT_HOURS_MONTHLY); RobotExecutionHoursMonthly=(Decimal-OrNull $_.ROBOT_EXECUTION_HOURS_MONTHLY); RobotMonthlyExecutionPercent=(Decimal-OrNull $_.ROBOT_MONTHLY_EXECUTION_PERCENT)
    RecordStatus='Current'; CustomerGeo=$_.CUSTOMER_GEO; CustomerRegion=$_.CUSTOMER_REGION; CustomerArea=$_.CUSTOMER_AREA
    CurrentContractEndDate=$_.CURRENT_CONTRACT_END_DATE; LicenseStatus=$_.LICENSE_STATUS
    AccountOwnerName=$_.ACCOUNT_OWNER_NAME; CsdName=$_.CSD_NAME; CustomerSuccessManagerName=$_.CUSTOMER_SUCCESS_MANAGER_NAME; TamName=$_.TAM_NAME
    CustomerSupportPackage=$_.CUSTOMER_SUPPORT_PACKAGE; CustomerId=$_.CUSTOMER_ID; CustomerAccount=$customerRecordIds[[string]$_.CUSTOMER_ID]
  }
})
$detailInserted = Insert-InBatches $detailEntityId $detailRecords 'detail-20260820-batch'

$rollupVerify = Invoke-UipJson @('df','records','query',$rollupEntityId,'--limit','1')
$detailVerify = Invoke-UipJson @('df','records','query',$detailEntityId,'--limit','1')
if ([int]$rollupVerify.Data.TotalCount -ne $rollupRows.Count -or [int]$detailVerify.Data.TotalCount -ne $detailRows.Count) {
  throw "Verification failed: rollup=$($rollupVerify.Data.TotalCount), detail=$($detailVerify.Data.TotalCount)"
}

[ordered]@{
  RollupDeleted=$rollupDeleted; DetailDeleted=$detailDeleted; RollupInserted=$rollupInserted; DetailInserted=$detailInserted
  RollupFinalCount=$rollupVerify.Data.TotalCount; DetailFinalCount=$detailVerify.Data.TotalCount; RelationshipField='CustomerAccount'; ParentCompanyField='ParentCompanyName'
} | ConvertTo-Json
