$dir = "C:\Users\Admin\Downloads\dhaathree_website (2)"
$files = Get-ChildItem -Path $dir -Filter *.html

foreach ($file in $files) {
    # Force reading file using UTF-8 encoding
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # 1. Remove Telugu tagline & update fallback character
    $content = $content -replace '(?s)<span class="te">.*?</span>', ''
    $content = $content -replace '(?s)<div class="te">.*?</div>', ''
    $content = $content -replace '(?s)<div class="hero-te">.*?</div>', ''

    # 2. Determine active page and open details for the nav block template
    $name = $file.Name.ToLower()
    
    $a_home = ""
    $a_about = ""
    $a_impact = ""
    $a_projects = ""
    $a_get_involved = ""
    $a_media = ""
    $a_resource = ""
    $a_contact = ""
    
    $open_about = ""
    $open_resource = ""
    
    if ($name -eq "index.html") {
        $a_home = ' class="active"'
    } elseif ($name -eq "about.html" -or $name -eq "partners.html") {
        $a_about = ' class="active"'
        $open_about = ' open'
    } elseif ($name -eq "impact.html") {
        $a_impact = ' class="active"'
    } elseif ($name -eq "projects.html" -or $name -like "*-dhaathree.html" -or $name -eq "ananda-nilayam.html" -or $name -eq "general-services.html") {
        $a_projects = ' class="active"'
    } elseif ($name -eq "get-involved.html") {
        $a_get_involved = ' class="active"'
    } elseif ($name -eq "media.html") {
        $a_media = ' class="active"'
    } elseif ($name -eq "resource-center.html") {
        $a_resource = ' class="active"'
        $open_resource = ' open'
    } elseif ($name -eq "contact.html") {
        $a_contact = ' class="active"'
    }

    # Generate a clean unified header and nav block
    $newHeader = @"
<div class="top-utility-bar" style="background: #E8F2E1; color: #5B2D8E; padding: 0 5%; font-family: 'Inter', sans-serif; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; height: 40px; position: fixed; top: 0; left: 0; right: 0; z-index: 101; box-sizing: border-box; border-bottom: 1.5px solid rgba(91,45,142,0.15);">
  <div style="display: flex; gap: 20px; align-items: center;">
    <a href="tel:7981885165" style="color: #5B2D8E; text-decoration: none; display: flex; align-items: center; gap: 8px; font-weight: 500; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
      <svg style="width: 15px; height: 15px; fill: #5B2D8E;" viewBox="0 0 24 24"><path d="M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm-5 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5-5H7V4h10v13z"/></svg>
      7981885165
    </a>
    <a href="mailto:info@dhaathreefoundation.org" style="color: #5B2D8E; text-decoration: none; display: flex; align-items: center; gap: 8px; font-weight: 500; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
      <svg style="width: 16px; height: 16px; fill: #5B2D8E;" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
      info@dhaathreefoundation.org
    </a>
  </div>
  <div style="display: flex; gap: 15px; align-items: center;">
    <div id="google_translate_element" style="margin-right: 5px;"></div>
    <a href="https://youtube.com/@dhaathree?si=tPsPeXDugK7N84UE" target="_blank" title="YouTube" style="color: #5B2D8E; text-decoration: none; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(91,45,142,0.1); transition: all 0.2s;" onmouseover="this.style.background='rgba(91,45,142,0.2)'" onmouseout="this.style.background='rgba(91,45,142,0.1)'">
      <svg style="width: 15px; height: 15px; fill: #5B2D8E;" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    </a>
    <a href="https://www.instagram.com/dhaatreefoundation?utm_source=qr&igsh=MTNkbmZnbm8wbjVzMw==" target="_blank" title="Instagram" style="color: #5B2D8E; text-decoration: none; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(91,45,142,0.1); transition: all 0.2s;" onmouseover="this.style.background='rgba(91,45,142,0.2)'" onmouseout="this.style.background='rgba(91,45,142,0.1)'">
      <svg style="width: 15px; height: 15px; fill: #5B2D8E;" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
    </a>
    <a href="https://www.facebook.com/share/17oWQKUg4a/" target="_blank" title="Facebook" style="color: #5B2D8E; text-decoration: none; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(91,45,142,0.1); transition: all 0.2s;" onmouseover="this.style.background='rgba(91,45,142,0.2)'" onmouseout="this.style.background='rgba(91,45,142,0.1)'">
      <svg style="width: 15px; height: 15px; fill: #5B2D8E;" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
    </a>
  </div>
</div>

<nav>
  <div class="nav-logo">
    <a href="index.html" style="display:flex;align-items:center;gap:12px;text-decoration:none;">
      <img src="logo.jpeg" alt="Dhaathree Foundation Logo"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
           id="navLogoImg"/>
      <div style="display:none; width:50px; height:50px; border-radius:50%; background:linear-gradient(135deg,#8DC63F,#5B2D8E); align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:1.1rem;" id="navLogoFallback">D</div>
      <div class="nav-brand">
        <span class="en">Dhaathree Foundation</span>
      </div>
    </a>
  </div>
  <ul class="nav-links">
    <li><a href="index.html"$a_home>Home</a></li>
    <li class="nav-dropdown">
      <a href="about.html" class="dropdown-trigger"$a_about>About <span class="nav-arrow">&#9662;</span></a>
      <ul class="nav-dropdown-menu">
        <li><a href="about.html">About Us</a></li>
        <li><a href="partners.html">Partners & Sponsors</a></li>
      </ul>
    </li>
    <li><a href="impact.html"$a_impact>Impact</a></li>
    <li><a href="projects.html"$a_projects>Projects</a></li>
    <li><a href="get-involved.html"$a_get_involved>Get Involved</a></li>
    <li><a href="media.html"$a_media>Media</a></li>
    <li class="nav-dropdown">
      <a href="resource-center.html" class="dropdown-trigger"$a_resource>Resource Center <span class="nav-arrow">&#9662;</span></a>
      <ul class="nav-dropdown-menu">
        <li><a href="resource-center.html?doc=registration">Registration Certificate</a></li>
        <li><a href="resource-center.html?doc=annual_report">Annual Activity Report</a></li>
      </ul>
    </li>
    <li><a href="contact.html"$a_contact>Contact</a></li>
  </ul>
  <a href="get-involved.html#donate" class="nav-cta">Donate Now</a>

  <button class="hamburger" onclick="toggleMobileMenu()" aria-label="Menu">&#9776;</button>

  <div class="mobile-menu" id="mobileMenu">
    <a href="index.html"$a_home onclick="toggleMobileMenu()">Home</a>
    
    <details class="mobile-menu-dropdown"$open_about>
      <summary>About <span class="arrow">&#9662;</span></summary>
      <div class="dropdown-links">
        <a href="about.html" onclick="toggleMobileMenu()">About Us</a>
        <a href="partners.html" onclick="toggleMobileMenu()">Partners & Sponsors</a>
      </div>
    </details>
    
    <a href="impact.html"$a_impact onclick="toggleMobileMenu()">Impact</a>
    <a href="projects.html"$a_projects onclick="toggleMobileMenu()">Projects</a>
    <a href="get-involved.html"$a_get_involved onclick="toggleMobileMenu()">Get Involved</a>
    <a href="media.html"$a_media onclick="toggleMobileMenu()">Media</a>
    
    <details class="mobile-menu-dropdown"$open_resource>
      <summary>Resource Center <span class="arrow">&#9662;</span></summary>
      <div class="dropdown-links">
        <a href="resource-center.html?doc=registration" onclick="toggleMobileMenu()">Registration Certificate</a>
        <a href="resource-center.html?doc=annual_report" onclick="toggleMobileMenu()">Annual Activity Report</a>
      </div>
    </details>
    
    <a href="contact.html"$a_contact onclick="toggleMobileMenu()">Contact</a>
    <a href="get-involved.html#donate" class="mobile-cta" onclick="toggleMobileMenu()">Get Involved</a>
  </div>
</nav>
"@

    # 3. Replace the header/nav blocks
    if ($content -match '(?s)<div class="top-utility-bar".*?</nav>') {
        $content = $content -replace '(?s)<div class="top-utility-bar".*?</nav>', $newHeader
    } elseif ($content -match '(?s)<nav>.*?</nav>') {
        if ($newHeader -match '(?s)<nav>.*?</nav>') {
            $newNavOnly = $Matches[0]
            $content = $content -replace '(?s)<nav>.*?</nav>', $newNavOnly
        }
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

    # Save content
    [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed and Updated: $($file.Name)"
}
