import os
from PIL import Image, ImageDraw

SITE_DIR = os.path.join(os.path.dirname(__file__), "..", "site")

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d1a17"/>
      <stop offset="100%" stop-color="#141210"/>
    </linearGradient>
    <linearGradient id="amber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d0801a"/>
      <stop offset="100%" stop-color="#a86212"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#d0801a" flood-opacity="0.6"/>
    </filter>
  </defs>
  <!-- 背景圆角底板 -->
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="rgba(255,244,232,0.22)" stroke-width="1.5"/>
  
  <!-- 战术治安护盾 (外轮廓) -->
  <path d="M 32 10 L 48 16 C 48 30 42 45 32 53 C 22 45 16 30 16 16 Z" 
        fill="none" stroke="url(#amber)" stroke-width="2.5" stroke-linejoin="round" filter="url(#glow)"/>
        
  <!-- 内部几何内核 (银杏/十字准星形态) -->
  <path d="M 32 20 L 32 42 M 22 29 L 42 29" 
        stroke="rgba(208,128,26,0.85)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="29" r="4" fill="url(#amber)"/>
  <circle cx="32" cy="29" r="7" fill="none" stroke="#d0801a" stroke-width="1.2" stroke-dasharray="2 3"/>
</svg>
'''

with open(os.path.join(SITE_DIR, "favicon.svg"), "w", encoding="utf-8") as f:
    f.write(svg_content)
print("Saved site/favicon.svg")

def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    scale = size / 64.0
    
    # 绘制背景
    r = int(14 * scale)
    d.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r, fill=(20, 18, 16, 255), outline=(208, 128, 26, 80), width=max(1, int(1.5 * scale)))
    
    # 绘制护盾
    pts = [
        (int(32 * scale), int(11 * scale)),
        (int(48 * scale), int(17 * scale)),
        (int(46 * scale), int(33 * scale)),
        (int(40 * scale), int(44 * scale)),
        (int(32 * scale), int(52 * scale)),
        (int(24 * scale), int(44 * scale)),
        (int(18 * scale), int(33 * scale)),
        (int(16 * scale), int(17 * scale)),
    ]
    d.polygon(pts, fill=(208, 128, 26, 40), outline=(208, 128, 26, 255))
    
    # 十字准星与中心圆
    cx, cy = int(32 * scale), int(30 * scale)
    lw = max(1, int(2 * scale))
    d.line([(cx, cy - int(9 * scale)), (cx, cy + int(9 * scale))], fill=(208, 128, 26, 235), width=lw)
    d.line([(cx - int(9 * scale), cy), (cx + int(9 * scale), cy)], fill=(208, 128, 26, 235), width=lw)
    
    cr = int(3.5 * scale)
    d.ellipse([(cx - cr, cy - cr), (cx + cr, cy + cr)], fill=(208, 128, 26, 255))
    return img

img_180 = draw_icon(180)
img_180.save(os.path.join(SITE_DIR, "apple-touch-icon.png"), "PNG")
print("Saved site/apple-touch-icon.png")

img_192 = draw_icon(192)
img_192.save(os.path.join(SITE_DIR, "icon-192.png"), "PNG")
print("Saved site/icon-192.png")

img_512 = draw_icon(512)
img_512.save(os.path.join(SITE_DIR, "icon-512.png"), "PNG")
print("Saved site/icon-512.png")

# 生成多尺寸 ICO (16, 32, 48)
img_16 = draw_icon(16)
img_32 = draw_icon(32)
img_48 = draw_icon(48)
img_48.save(os.path.join(SITE_DIR, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[img_32, img_16])
print("Saved site/favicon.ico")
