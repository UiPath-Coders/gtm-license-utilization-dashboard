param([ValidateSet('Prepare','Execute','Resume')][string]$Stage = 'Prepare')

$ErrorActionPreference = 'Stop'
$rollupCsv = 'C:\Users\logesh.velu\Downloads\AMER FINS — Active Customer Account Rollup_2026-08-16-1507.csv'
$detailCsv = 'C:\Users\logesh.velu\Downloads\AMER FINS — Active License Key Detail_2026-08-16-1507.csv'
$oldRollupEntityId = 'c1fa9d52-9a99-f111-9b33-7c1e521513a8'
$oldDetailEntityId = '7b2ed85b-9a99-f111-9b33-7c1e521513a8'
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

function Insert-InBatches([string]$EntityId, [object[]]$Records, [string]$Prefix) {
  $success = 0
  $failure = 0
  for ($i = 0; $i -lt $Records.Count; $i += 200) {
    $end = [Math]::Min($i + 199, $Records.Count - 1)
    $path = Join-Path $workDir "$Prefix-$([int]($i / 200) + 1).json"
    @($Records[$i..$end]) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $path -Encoding utf8
    $result = Invoke-UipJson @('df','records','insert',$EntityId,'--file',$path)
    $success += [int]$result.Data.SuccessCount
    $failure += [int]$result.Data.FailureCount
  }
  return [pscustomobject]@{ Success = $success; Failure = $failure }
}

$rollupRows = @(Import-Csv -LiteralPath $rollupCsv)
$detailRows = @(Import-Csv -LiteralPath $detailCsv)
$duplicateCustomers = @($rollupRows | Group-Object CUSTOMER_ID | Where-Object Count -gt 1)
$duplicateDetails = @($detailRows | Group-Object CUSTOMER_ID,LICENSECODE,LICENSE_CATEGORY,AS_OF_DATE,RECORD_STATUS | Where-Object Count -gt 1)
$rollupIds = @($rollupRows.CUSTOMER_ID | Sort-Object -Unique)
$detailIds = @($detailRows.CUSTOMER_ID | Sort-Object -Unique)
$unmatched = @($detailIds | Where-Object { $_ -notin $rollupIds })

if ($duplicateCustomers.Count -or $duplicateDetails.Count -or $unmatched.Count) {
  throw "Preflight failed: duplicate customers=$($duplicateCustomers.Count), duplicate detail keys=$($duplicateDetails.Count), unmatched customers=$($unmatched.Count)"
}

if ($Stage -eq 'Prepare') {
  [pscustomobject]@{
    RollupRows = $rollupRows.Count
    DetailRows = $detailRows.Count
    UniqueCustomers = $rollupIds.Count
    DuplicateCustomers = $duplicateCustomers.Count
    DuplicateDetailKeys = $duplicateDetails.Count
    UnmatchedCustomers = $unmatched.Count
  } | ConvertTo-Json
  exit 0
}

$oldRollupRecords = @()
$oldDetailRecords = @()
if ($Stage -eq 'Execute') {
  $oldRollupRecords = Get-AllRecords $oldRollupEntityId
  $oldDetailRecords = Get-AllRecords $oldDetailEntityId
  $oldRollupRecords | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $workDir 'AmerFinsActiveCustomerAccountRollup-backup-before-1507.json') -Encoding utf8
  $oldDetailRecords | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $workDir 'AmerFinsActiveLicenseKeyDetail-backup-before-1507.json') -Encoding utf8

  # The detail entity is the only inbound dependency on the rollup entity, so delete it first.
  $deleteOldDetail = Invoke-UipJson @('df','entities','delete',$oldDetailEntityId,'--yes','--reason','Replace with approved 2026-08-16 15:07 AMER FINS active license detail CSV')
  $deleteOldRollup = Invoke-UipJson @('df','entities','delete',$oldRollupEntityId,'--yes','--reason','Replace with approved 2026-08-16 15:07 AMER FINS customer rollup CSV')
} else {
  # Remove the partial rollup created by the first load attempt; durable backups already exist.
  $deletePartialRollup = Invoke-UipJson @('df','entities','delete','272f2171-a699-f111-9b33-7c1e521513a8','--yes','--reason','Restart approved 15:07 replacement after making blank ownership fields optional')
}

$d0 = { param($name,$display) [ordered]@{fieldName=$name;type='DECIMAL';decimalPrecision=0;minValue=0;maxValue=1000000000000;isRequired=$true;displayName=$display} }
$d2o = { param($name,$display) [ordered]@{fieldName=$name;type='DECIMAL';decimalPrecision=2;minValue=0;maxValue=1000000000000;isRequired=$false;displayName=$display} }
$d9 = { param($name,$display,$required=$true) [ordered]@{fieldName=$name;type='DECIMAL';decimalPrecision=9;minValue=0;maxValue=1000000000000;isRequired=$required;displayName=$display} }
$str = { param($name,$display,$length,$unique=$false,$required=$true) [ordered]@{fieldName=$name;type='STRING';lengthLimit=$length;isRequired=$required;isUnique=$unique;displayName=$display} }
$date = { param($name,$display) [ordered]@{fieldName=$name;type='DATE';isRequired=$true;displayName=$display} }

$rollupFields = @(
  (&$str 'CustomerName' 'Customer Name' 255),
  (&$d0 'ActiveLicenseKeyCount' 'Active License Key Count'),
  (&$date 'LatestAsOfDate' 'Latest As of Date'),
  (&$d0 'UnattendedProdPurchased' 'Unattended Production Purchased'),
  (&$d0 'UnattendedProdUtilized' 'Unattended Production Utilized'),
  (&$d2o 'UnattendedProdUtilizationPercent' 'Unattended Production Utilization Percent'),
  (&$d0 'TestRobotPurchased' 'Test Robot Purchased'),
  (&$d0 'TestRobotUtilized' 'Test Robot Utilized'),
  (&$d2o 'TestRobotUtilizationPercent' 'Test Robot Utilization Percent'),
  (&$d0 'UserLicensePurchased' 'User License Purchased'),
  (&$d0 'UserLicenseUtilized' 'User License Utilized'),
  (&$d2o 'UserLicenseUtilizationPercent' 'User License Utilization Percent'),
  (&$d0 'AiUnitsPurchased' 'AI Units Purchased'),
  (&$d9 'AiUnitsUtilized' 'AI Units Utilized'),
  (&$d2o 'AiUnitsUtilizationPercent' 'AI Units Utilization Percent'),
  (&$d0 'AgentUnitsPurchased' 'Agent Units Purchased'),
  (&$d0 'AgentUnitsUtilized' 'Agent Units Utilized'),
  (&$d2o 'AgentUnitsUtilizationPercent' 'Agent Units Utilization Percent'),
  (&$d0 'PlatformUnitsPurchased' 'Platform Units Purchased'),
  (&$d9 'PlatformUnitsUtilized' 'Platform Units Utilized'),
  (&$d2o 'PlatformUnitsUtilizationPercent' 'Platform Units Utilization Percent'),
  (&$d0 'OtherUnmappedPurchasedUnits' 'Other Unmapped Purchased Units'),
  (&$d0 'UtilizationWithoutMatchedPurchaseRows' 'Utilization Without Matched Purchase Rows'),
  (&$str 'DeploymentType' 'Deployment Type' 100),
  (&$str 'CustomerGeo' 'Customer Geo' 20),
  (&$str 'CustomerRegion' 'Customer Region' 100),
  (&$str 'CustomerArea' 'Customer Area' 100),
  (&$date 'EarliestActiveContractEndDate' 'Earliest Active Contract End Date'),
  (&$date 'LatestActiveContractEndDate' 'Latest Active Contract End Date'),
  (&$str 'AccountOwnerName' 'Account Owner Name' 255),
  (&$str 'CsdName' 'CSD Name' 255 $false $false),
  (&$str 'CustomerSuccessManagerName' 'Customer Success Manager Name' 255 $false $false),
  (&$str 'TamName' 'TAM Name' 255 $false $false),
  (&$str 'CustomerSupportPackage' 'Customer Support Package' 100),
  (&$str 'CustomerId' 'Customer ID' 50 $true)
)
$rollupBody = [ordered]@{displayName='AMER FINS — Active Customer Account Rollup';description='Current AMER FINS customer-level license utilization, ownership, deployment, and contract rollup.';fields=$rollupFields} | ConvertTo-Json -Depth 6 -Compress
$rollupCreate = Invoke-UipJson @('df','entities','create','AmerFinsActiveCustomerAccountRollup','--body',$rollupBody)
$rollupEntityId = [string]$rollupCreate.Data.Id
$rollupSchema = Invoke-UipJson @('df','entities','get',$rollupEntityId)
$customerIdFieldId = [string](($rollupSchema.Data.Fields | Where-Object Name -eq 'CustomerId').Id)

$rollupRecords = @($rollupRows | ForEach-Object {
  [ordered]@{
    CustomerName=$_.CUSTOMER_NAME; ActiveLicenseKeyCount=[decimal]$_.ACTIVE_LICENSE_KEY_COUNT; LatestAsOfDate=$_.LATEST_AS_OF_DATE
    UnattendedProdPurchased=[decimal]$_.UNATTENDED_PROD_PURCHASED; UnattendedProdUtilized=[decimal]$_.UNATTENDED_PROD_UTILIZED; UnattendedProdUtilizationPercent=(Decimal-OrNull $_.UNATTENDED_PROD_UTILIZATION_PERCENT)
    TestRobotPurchased=[decimal]$_.TEST_ROBOT_PURCHASED; TestRobotUtilized=[decimal]$_.TEST_ROBOT_UTILIZED; TestRobotUtilizationPercent=(Decimal-OrNull $_.TEST_ROBOT_UTILIZATION_PERCENT)
    UserLicensePurchased=[decimal]$_.USER_LICENSE_PURCHASED; UserLicenseUtilized=[decimal]$_.USER_LICENSE_UTILIZED; UserLicenseUtilizationPercent=(Decimal-OrNull $_.USER_LICENSE_UTILIZATION_PERCENT)
    AiUnitsPurchased=[decimal]$_.AI_UNITS_PURCHASED; AiUnitsUtilized=[decimal]$_.AI_UNITS_UTILIZED; AiUnitsUtilizationPercent=(Decimal-OrNull $_.AI_UNITS_UTILIZATION_PERCENT)
    AgentUnitsPurchased=[decimal]$_.AGENT_UNITS_PURCHASED; AgentUnitsUtilized=[decimal]$_.AGENT_UNITS_UTILIZED; AgentUnitsUtilizationPercent=(Decimal-OrNull $_.AGENT_UNITS_UTILIZATION_PERCENT)
    PlatformUnitsPurchased=[decimal]$_.PLATFORM_UNITS_PURCHASED; PlatformUnitsUtilized=[decimal]$_.PLATFORM_UNITS_UTILIZED; PlatformUnitsUtilizationPercent=(Decimal-OrNull $_.PLATFORM_UNITS_UTILIZATION_PERCENT)
    OtherUnmappedPurchasedUnits=[decimal]$_.OTHER_UNMAPPED_PURCHASED_UNITS; UtilizationWithoutMatchedPurchaseRows=[decimal]$_.UTILIZATION_WITHOUT_MATCHED_PURCHASE_ROWS
    DeploymentType=$_.DEPLOYMENT_TYPE; CustomerGeo=$_.CUSTOMER_GEO; CustomerRegion=$_.CUSTOMER_REGION; CustomerArea=$_.CUSTOMER_AREA
    EarliestActiveContractEndDate=$_.EARLIEST_ACTIVE_CONTRACT_END_DATE; LatestActiveContractEndDate=$_.LATEST_ACTIVE_CONTRACT_END_DATE
    AccountOwnerName=$_.ACCOUNT_OWNER_NAME; CsdName=$_.CSD_NAME; CustomerSuccessManagerName=$_.CUSTOMER_SUCCESS_MANAGER_NAME; TamName=$_.TAM_NAME
    CustomerSupportPackage=$_.CUSTOMER_SUPPORT_PACKAGE; CustomerId=$_.CUSTOMER_ID
  }
})
$rollupInsert = Insert-InBatches $rollupEntityId $rollupRecords 'rollup-batch'
if ($rollupInsert.Failure -ne 0) { throw "Rollup insert failures: $($rollupInsert.Failure)" }

$parentRecords = Get-AllRecords $rollupEntityId
$customerRecordIds = @{}
foreach ($record in $parentRecords) { $customerRecordIds[[string]$record.CustomerId] = [string]$record.Id }

$detailFields = @(
  ([ordered]@{fieldName='RecordKey';type='STRING';lengthLimit=700;isRequired=$true;isUnique=$true;displayName='Record Key'}),
  (&$str 'CustomerName' 'Customer Name' 255),
  (&$str 'LicenseCode' 'License Code' 100),
  (&$str 'DeploymentType' 'Deployment Type' 100),
  (&$str 'LicenseCategory' 'License Category' 100),
  (&$date 'AsOfDate' 'As of Date'),
  (&$d0 'PurchasedUnits' 'Purchased Units'),
  (&$d9 'UtilizedUnits' 'Utilized Units' $false),
  (&$d2o 'UtilizationPercent' 'Utilization Percent'),
  (&$str 'RecordStatus' 'Record Status' 100),
  (&$str 'CustomerGeo' 'Customer Geo' 20),
  (&$str 'CustomerRegion' 'Customer Region' 100),
  (&$str 'CustomerArea' 'Customer Area' 100),
  (&$date 'CurrentContractEndDate' 'Current Contract End Date'),
  (&$str 'LicenseStatus' 'License Status' 50),
  (&$str 'AccountOwnerName' 'Account Owner Name' 255),
  (&$str 'CsdName' 'CSD Name' 255 $false $false),
  (&$str 'CustomerSuccessManagerName' 'Customer Success Manager Name' 255 $false $false),
  (&$str 'TamName' 'TAM Name' 255 $false $false),
  (&$str 'CustomerSupportPackage' 'Customer Support Package' 100),
  (&$str 'CustomerId' 'Customer ID' 50),
  ([ordered]@{fieldName='CustomerAccount';type='RELATIONSHIP';referenceEntityId=$rollupEntityId;referenceFieldId=$customerIdFieldId;isRequired=$true;displayName='Customer Account';description='Links this license record to its AMER FINS customer account rollup.'})
)
$detailBody = [ordered]@{displayName='AMER FINS — Active License Key Detail';description='Current AMER FINS active license-key entitlements and utilization by customer, license, category, and record status.';fields=$detailFields} | ConvertTo-Json -Depth 6 -Compress
$detailCreate = Invoke-UipJson @('df','entities','create','AmerFinsActiveLicenseKeyDetail','--body',$detailBody)
$detailEntityId = [string]$detailCreate.Data.Id

$detailRecords = @($detailRows | ForEach-Object {
  [ordered]@{
    RecordKey="$($_.CUSTOMER_ID)|$($_.LICENSECODE)|$($_.LICENSE_CATEGORY)|$($_.AS_OF_DATE)|$($_.RECORD_STATUS)"
    CustomerName=$_.CUSTOMER_NAME; LicenseCode=$_.LICENSECODE; DeploymentType=$_.DEPLOYMENT_TYPE; LicenseCategory=$_.LICENSE_CATEGORY; AsOfDate=$_.AS_OF_DATE
    PurchasedUnits=[decimal]$_.PURCHASED_UNITS; UtilizedUnits=(Decimal-OrNull $_.UTILIZED_UNITS); UtilizationPercent=(Decimal-OrNull $_.UTILIZATION_PERCENT)
    RecordStatus=$_.RECORD_STATUS; CustomerGeo=$_.CUSTOMER_GEO; CustomerRegion=$_.CUSTOMER_REGION; CustomerArea=$_.CUSTOMER_AREA
    CurrentContractEndDate=$_.CURRENT_CONTRACT_END_DATE; LicenseStatus=$_.LICENSE_STATUS
    AccountOwnerName=$_.ACCOUNT_OWNER_NAME; CsdName=$_.CSD_NAME; CustomerSuccessManagerName=$_.CUSTOMER_SUCCESS_MANAGER_NAME; TamName=$_.TAM_NAME
    CustomerSupportPackage=$_.CUSTOMER_SUPPORT_PACKAGE; CustomerId=$_.CUSTOMER_ID
    CustomerAccount=$customerRecordIds[[string]$_.CUSTOMER_ID]
  }
})
$detailInsert = Insert-InBatches $detailEntityId $detailRecords 'detail-batch'
if ($detailInsert.Failure -ne 0) { throw "Detail insert failures: $($detailInsert.Failure)" }

$rollupVerify = Invoke-UipJson @('df','records','query',$rollupEntityId,'--limit','1')
$detailVerify = Invoke-UipJson @('df','records','query',$detailEntityId,'--limit','1')
if ([int]$rollupVerify.Data.TotalCount -ne $rollupRows.Count -or [int]$detailVerify.Data.TotalCount -ne $detailRows.Count) {
  throw "Verification failed: rollup=$($rollupVerify.Data.TotalCount), detail=$($detailVerify.Data.TotalCount)"
}

[ordered]@{
  RollupEntityId=$rollupEntityId; RollupInserted=$rollupInsert.Success; RollupFinalCount=$rollupVerify.Data.TotalCount
  DetailEntityId=$detailEntityId; DetailInserted=$detailInsert.Success; DetailFinalCount=$detailVerify.Data.TotalCount
  RelationshipField='CustomerAccount'; OldRollupEntityDeleted=$oldRollupEntityId; OldDetailEntityDeleted=$oldDetailEntityId
  OldRollupBackupCount=$oldRollupRecords.Count; OldDetailBackupCount=$oldDetailRecords.Count
} | ConvertTo-Json
