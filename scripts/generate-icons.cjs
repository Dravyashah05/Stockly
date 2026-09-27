const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Master App Icon SVG (Full icon with background)
const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="50%" stop-color="#4338CA"/>
      <stop offset="100%" stop-color="#1E1B4B"/>
    </linearGradient>
    <linearGradient id="boxTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E0E7FF"/>
    </linearGradient>
    <linearGradient id="boxLeft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#C7D2FE"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
    <linearGradient id="boxRight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EEF2FF"/>
      <stop offset="100%" stop-color="#C7D2FE"/>
    </linearGradient>
    <linearGradient id="ribbonTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="ribbonLeft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <linearGradient id="ribbonRight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0EA5E9"/>
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.45"/>
    </filter>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#047857" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="512" height="512" rx="116" fill="url(#bgGrad)"/>

  <!-- Subtle glow inner border -->
  <rect x="6" y="6" width="500" height="500" rx="110" fill="none" stroke="#6366F1" stroke-width="3" stroke-opacity="0.4"/>

  <!-- 3D Isometric Inventory Box -->
  <g filter="url(#dropShadow)">
    <!-- Box Top Face -->
    <path d="M256 120 L380 186 L256 254 L132 186 Z" fill="url(#boxTop)"/>

    <!-- Box Left Face -->
    <path d="M132 186 L256 254 L256 386 L132 318 Z" fill="url(#boxLeft)"/>

    <!-- Box Right Face -->
    <path d="M256 254 L380 186 L380 318 L256 386 Z" fill="url(#boxRight)"/>

    <!-- Center Ribbon (Top Face) -->
    <path d="M236 131 L276 109 L302 123 L262 145 Z" fill="url(#ribbonTop)"/>
    <path d="M194 153 L220 139 L318 193 L292 207 Z" fill="url(#ribbonTop)"/>

    <!-- Center Ribbon (Left Face) -->
    <path d="M194 220 L220 234 L220 366 L194 352 Z" fill="url(#ribbonLeft)"/>

    <!-- Center Ribbon (Right Face) -->
    <path d="M292 207 L318 193 L318 325 L292 339 Z" fill="url(#ribbonRight)"/>

    <!-- Shipping Label on Left Face -->
    <rect x="156" y="240" width="28" height="34" rx="3" fill="#FFFFFF" opacity="0.9" transform="skewY(26)"/>
    <rect x="160" y="245" width="20" height="3" rx="1.5" fill="#6366F1" opacity="0.8" transform="skewY(26)"/>
    <rect x="160" y="252" width="14" height="3" rx="1.5" fill="#94A3B8" opacity="0.8" transform="skewY(26)"/>
    <rect x="160" y="259" width="18" height="3" rx="1.5" fill="#94A3B8" opacity="0.8" transform="skewY(26)"/>
  </g>

  <!-- Stock Growth Badge (Floating bottom right) -->
  <g filter="url(#badgeShadow)">
    <circle cx="360" cy="355" r="70" fill="url(#badgeGrad)"/>
    <circle cx="360" cy="355" r="66" fill="none" stroke="#A7F3D0" stroke-width="2.5" stroke-opacity="0.6"/>

    <!-- Bar Chart inside Badge -->
    <rect x="328" y="365" width="14" height="30" rx="4" fill="#FFFFFF"/>
    <rect x="353" y="345" width="14" height="50" rx="4" fill="#FFFFFF"/>
    <rect x="378" y="325" width="14" height="70" rx="4" fill="#FFFFFF"/>

    <!-- Growth Trend Arrow Overlay -->
    <path d="M322 355 L352 330 L372 342 L402 312" fill="none" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M390 312 L402 312 L402 324" fill="none" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// 2. Round Master Icon SVG
const masterRoundSvg = masterSvg.replace('rx="116"', 'rx="256"').replace('rx="110"', 'rx="250"');

// 3. Foreground-only SVG for Adaptive Icons (108dp viewport)
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="boxTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E0E7FF"/>
    </linearGradient>
    <linearGradient id="boxLeft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#C7D2FE"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
    <linearGradient id="boxRight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EEF2FF"/>
      <stop offset="100%" stop-color="#C7D2FE"/>
    </linearGradient>
    <linearGradient id="ribbonTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="ribbonLeft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <linearGradient id="ribbonRight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0EA5E9"/>
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.4"/>
    </filter>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#047857" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Scale and center slightly for the 72dp safe zone of adaptive icon -->
  <g transform="translate(35, 30) scale(0.86)">
    <!-- 3D Isometric Inventory Box -->
    <g filter="url(#dropShadow)">
      <!-- Box Top Face -->
      <path d="M256 120 L380 186 L256 254 L132 186 Z" fill="url(#boxTop)"/>

      <!-- Box Left Face -->
      <path d="M132 186 L256 254 L256 386 L132 318 Z" fill="url(#boxLeft)"/>

      <!-- Box Right Face -->
      <path d="M256 254 L380 186 L380 318 L256 386 Z" fill="url(#boxRight)"/>

      <!-- Center Cross Ribbon (Top) -->
      <path d="M194 153 L220 139 L318 193 L292 207 Z" fill="url(#ribbonTop)"/>

      <!-- Center Ribbon (Left Face) -->
      <path d="M194 220 L220 234 L220 366 L194 352 Z" fill="url(#ribbonLeft)"/>

      <!-- Center Ribbon (Right Face) -->
      <path d="M292 207 L318 193 L318 325 L292 339 Z" fill="url(#ribbonRight)"/>

      <!-- Shipping Label on Left Face -->
      <rect x="156" y="240" width="28" height="34" rx="3" fill="#FFFFFF" opacity="0.9" transform="skewY(26)"/>
      <rect x="160" y="245" width="20" height="3" rx="1.5" fill="#6366F1" opacity="0.8" transform="skewY(26)"/>
      <rect x="160" y="252" width="14" height="3" rx="1.5" fill="#94A3B8" opacity="0.8" transform="skewY(26)"/>
      <rect x="160" y="259" width="18" height="3" rx="1.5" fill="#94A3B8" opacity="0.8" transform="skewY(26)"/>
    </g>

    <!-- Stock Growth Badge -->
    <g filter="url(#badgeShadow)">
      <circle cx="360" cy="355" r="68" fill="url(#badgeGrad)"/>
      <circle cx="360" cy="355" r="64" fill="none" stroke="#A7F3D0" stroke-width="2.5" stroke-opacity="0.6"/>

      <!-- Bar Chart inside Badge -->
      <rect x="328" y="365" width="14" height="30" rx="4" fill="#FFFFFF"/>
      <rect x="353" y="345" width="14" height="50" rx="4" fill="#FFFFFF"/>
      <rect x="378" y="325" width="14" height="70" rx="4" fill="#FFFFFF"/>

      <!-- Growth Trend Arrow Overlay -->
      <path d="M322 355 L352 330 L372 342 L402 312" fill="none" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M390 312 L402 312 L402 324" fill="none" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;

async function run() {
  const masterBuf = Buffer.from(masterSvg);
  const roundBuf = Buffer.from(masterRoundSvg);
  const fgBuf = Buffer.from(foregroundSvg);

  // Write SVG files
  fs.writeFileSync(path.resolve(__dirname, '../client/public/favicon.svg'), masterSvg);

  const targets = [
    // Web / PWA
    { path: '../client/public/icon-192.png', size: 192, buf: masterBuf },
    { path: '../client/public/icon-512.png', size: 512, buf: masterBuf },
    { path: '../android/app/src/main/assets/public/icon-192.png', size: 192, buf: masterBuf },
    { path: '../android/app/src/main/assets/public/icon-512.png', size: 512, buf: masterBuf },

    // Android Mipmaps (Legacy Launcher Icon)
    { path: '../android/app/src/main/res/mipmap-mdpi/ic_launcher.png', size: 48, buf: masterBuf },
    { path: '../android/app/src/main/res/mipmap-hdpi/ic_launcher.png', size: 72, buf: masterBuf },
    { path: '../android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', size: 96, buf: masterBuf },
    { path: '../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', size: 144, buf: masterBuf },
    { path: '../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', size: 192, buf: masterBuf },

    // Android Round Icons
    { path: '../android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png', size: 48, buf: roundBuf },
    { path: '../android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png', size: 72, buf: roundBuf },
    { path: '../android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png', size: 96, buf: roundBuf },
    { path: '../android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png', size: 144, buf: roundBuf },
    { path: '../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png', size: 192, buf: roundBuf },

    // Android Foreground for Adaptive Icons
    { path: '../android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png', size: 108, buf: fgBuf },
    { path: '../android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png', size: 162, buf: fgBuf },
    { path: '../android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png', size: 216, buf: fgBuf },
    { path: '../android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png', size: 324, buf: fgBuf },
    { path: '../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', size: 432, buf: fgBuf },
  ];

  for (const t of targets) {
    const fullPath = path.resolve(__dirname, t.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await sharp(t.buf)
      .resize(t.size, t.size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(fullPath);
    console.log(`Generated: ${t.path} (${t.size}x${t.size})`);
  }

  console.log('All app icons generated successfully!');
}

run().catch(console.error);
