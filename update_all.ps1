$dir = "C:\Users\Admin\Downloads\dhaathree_website (2)"
$files = Get-ChildItem -Path $dir -Filter *.html

foreach ($file in $files) {
    # Force reading file using UTF-8 encoding
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # 1. Restore Telugu tagline & fallback character
    $content = $content -replace '(?s)<span class="te">.*?</span>', '<span class="te">మీ సాధికారత కొరకై...</span>'
    $content = $content -replace '(?s)<div class="te">.*?</div>', '<div class="te">మీ సాధికారత కొరకై...</div>'
    $content = $content -replace '(?s)<div class="hero-te">.*?</div>', '<div class="hero-te">మీ సాధికారత కొరకై...</div>'
    $content = $content -replace 'id="navLogoFallback">.*?</div>', 'id="navLogoFallback">ధ</div>'
    
    # Restoring (ధాత్రి) text inside index.html description
    if ($file.Name -eq "index.html") {
        $content = $content -replace 'The word <em>Dhaathree</em> \(.*?\) means Earth .*?(\r?\n)', "The word <em>Dhaathree</em> (ధాత్రి) means Earth — the sustainer of all life.`n"
    }

    # 2. Replace nav links block (Resource Center before Contact)
    if ($content -match '(?s)<ul class="nav-links">.*?</ul>') {
        $navBlock = $Matches[0]
        $activePage = ""
        if ($navBlock -like '*index.html" class="active"*') { $activePage = "home" }
        elseif ($navBlock -like '*about.html" class="active"*') { $activePage = "about" }
        elseif ($navBlock -like '*impact.html" class="active"*') { $activePage = "impact" }
        elseif ($navBlock -like '*projects.html" class="active"*') { $activePage = "projects" }
        elseif ($navBlock -like '*get-involved.html" class="active"*') { $activePage = "get-involved" }
        elseif ($navBlock -like '*media.html" class="active"*') { $activePage = "media" }
        elseif ($navBlock -like '*resource-center.html" class="active"*') { $activePage = "resource" }
        elseif ($navBlock -like '*contact.html" class="active"*') { $activePage = "contact" }
        
        $a_home = if ($activePage -eq "home") { ' class="active"' } else { '' }
        $a_about = if ($activePage -eq "about") { ' class="active"' } else { '' }
        $a_impact = if ($activePage -eq "impact") { ' class="active"' } else { '' }
        $a_projects = if ($activePage -eq "projects") { ' class="active"' } else { '' }
        $a_get_involved = if ($activePage -eq "get-involved") { ' class="active"' } else { '' }
        $a_media = if ($activePage -eq "media") { ' class="active"' } else { '' }
        $a_resource = if ($activePage -eq "resource") { ' class="active"' } else { '' }
        $a_contact = if ($activePage -eq "contact") { ' class="active"' } else { '' }

        $newNav = @"
<ul class="nav-links">
    <li><a href="index.html"$a_home>Home</a></li>
    <li><a href="about.html"$a_about>About</a></li>
    <li><a href="impact.html"$a_impact>Impact</a></li>
    <li><a href="projects.html"$a_projects>Projects</a></li>
    <li><a href="get-involved.html"$a_get_involved>Get Involved</a></li>
    <li><a href="media.html"$a_media>Media</a></li>
    <li><a href="resource-center.html"$a_resource>Resource Center</a></li>
    <li><a href="contact.html"$a_contact>Contact</a></li>
  </ul>
"@
        $content = $content -replace '(?s)<ul class="nav-links">.*?</ul>', $newNav
    }

    # 3. Replace mobile menu block
    if ($content -match '(?s)<div class="mobile-menu" id="mobileMenu">.*?</div>') {
        $mobileBlock = $Matches[0]
        $activePage = ""
        if ($mobileBlock -like '*index.html" class="active"*') { $activePage = "home" }
        elseif ($mobileBlock -like '*about.html" class="active"*') { $activePage = "about" }
        elseif ($mobileBlock -like '*impact.html" class="active"*') { $activePage = "impact" }
        elseif ($mobileBlock -like '*projects.html" class="active"*') { $activePage = "projects" }
        elseif ($mobileBlock -like '*get-involved.html" class="active"*') { $activePage = "get-involved" }
        elseif ($mobileBlock -like '*media.html" class="active"*') { $activePage = "media" }
        elseif ($mobileBlock -like '*resource-center.html" class="active"*') { $activePage = "resource" }
        elseif ($mobileBlock -like '*contact.html" class="active"*') { $activePage = "contact" }
        
        $a_home = if ($activePage -eq "home") { ' class="active"' } else { '' }
        $a_about = if ($activePage -eq "about") { ' class="active"' } else { '' }
        $a_impact = if ($activePage -eq "impact") { ' class="active"' } else { '' }
        $a_projects = if ($activePage -eq "projects") { ' class="active"' } else { '' }
        $a_get_involved = if ($activePage -eq "get-involved") { ' class="active"' } else { '' }
        $a_media = if ($activePage -eq "media") { ' class="active"' } else { '' }
        $a_resource = if ($activePage -eq "resource") { ' class="active"' } else { '' }
        $a_contact = if ($activePage -eq "contact") { ' class="active"' } else { '' }

        $newMobile = @"
<div class="mobile-menu" id="mobileMenu">
    <a href="index.html"$a_home onclick="toggleMobileMenu()">Home</a>
    <a href="about.html"$a_about onclick="toggleMobileMenu()">About</a>
    <a href="impact.html"$a_impact onclick="toggleMobileMenu()">Impact</a>
    <a href="projects.html"$a_projects onclick="toggleMobileMenu()">Projects</a>
    <a href="get-involved.html"$a_get_involved onclick="toggleMobileMenu()">Get Involved</a>
    <a href="media.html"$a_media onclick="toggleMobileMenu()">Media</a>
    <a href="resource-center.html"$a_resource onclick="toggleMobileMenu()">Resource Center</a>
    <a href="contact.html"$a_contact onclick="toggleMobileMenu()">Contact</a>
    <a href="get-involved.html#donate" class="mobile-cta" onclick="toggleMobileMenu()">Support a Cause</a>
  </div>
"@
        $content = $content -replace '(?s)<div class="mobile-menu" id="mobileMenu">.*?</div>', $newMobile
    }

    # 4. Replace footer links block
    if ($content -match '(?s)<div class="footer-links">.*?</div>') {
        $newFooter = @"
<div class="footer-links">
        <a href="index.html">Home</a>
        <a href="about.html">About</a>
        <a href="projects.html">Projects</a>
        <a href="impact.html">Impact</a>
        <a href="get-involved.html">Get Involved</a>
        <a href="media.html">Media</a>
        <a href="resource-center.html">Resource Center</a>
        <a href="contact.html">Contact</a>
      </div>
"@
        $content = $content -replace '(?s)<div class="footer-links">.*?</div>', $newFooter
    }

    # 4.5. Replace footer copy block (Privacy Policy and Terms & Conditions)
    if ($content -match '(?s)<div class="footer-copy">.*?</div>') {
        $newFooterCopyText = '<div class="footer-copy">&copy; 2026 Dhaathree Foundation &bull; Regd. No. 103/2019 &bull; All rights reserved &bull; <a href="privacy-policy.html" style="color: inherit; text-decoration: underline; white-space: nowrap; margin-left: 5px;">Privacy Policy</a> &bull; <a href="terms-and-conditions.html" style="color: inherit; text-decoration: underline; white-space: nowrap; margin-left: 5px;">Terms & Conditions</a></div>'
        $content = $content -replace '(?s)<div class="footer-copy">.*?</div>', $newFooterCopyText
    }

    # 5. Fix Support a Cause CTA
    $content = $content -replace 'class="nav-cta">Get Involved</a>', 'class="nav-cta">Support a Cause</a>'

    # Save content
    [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed and Updated: $($file.Name)"
}
