$files = Get-ChildItem -Path test -Filter *.dart -Recurse
foreach ($f in $files) {
    $c = Get-Content $f.FullName -Raw
    $changed = $false
    
    if ($c -match ",,") {
        $c = $c -replace ",,", ","
        $changed = $true
    }
    
    if ($f.Name -eq "dashboard_widgets_test.dart") {
        $c = $c -replace "package:voltium_rider/features/dashboard/widgets/", "package:voltium_rider/widgets/"
        $changed = $true
    }
    
    if ($changed) {
        Set-Content $f.FullName $c -NoNewline
    }
}
