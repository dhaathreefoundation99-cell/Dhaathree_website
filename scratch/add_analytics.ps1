param (
    [Parameter(Mandatory=$true)]
    [string]$MeasurementId
)

$dir = "C:\Users\Admin\Downloads\dhaathree_website (2)"
$files = Get-ChildItem -Path $dir -Filter *.html

$analyticsSnippet = @"
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=$MeasurementId"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '$MeasurementId');
  </script>
"@

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # Check if Google tag is already installed
    if ($content -like "*www.googletagmanager.com/gtag/js*") {
        Write-Host "Google Analytics already exists in: $($file.Name)"
        continue
    }

    # Inject immediately after <head> tag
    if ($content -match "<head>") {
        $content = $content -replace "<head>", "<head>`n$analyticsSnippet"
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Success: Installed Google Analytics in: $($file.Name)"
    } else {
        Write-Warning "Failed: Could not find <head> tag in: $($file.Name)"
    }
}
