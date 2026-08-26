import struct, zlib, os, sys

def create_png(w, h, r, g, b, a=255):
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
    
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter byte
        cx, cy = w // 2, h // 2
        for x in range(w):
            # Simple bolt shape
            in_bolt = (abs(x - cx) < w // 12 and abs(y - cy) < h // 5) or \
                      (y > cy + h // 8 and y < cy + h // 4 and abs(x - cx) < (h // 4) - (y - cy - h // 8) * 0.6)
            if in_bolt:
                raw.extend([255, 204, 0, 255])  # yellow bolt
            else:
                raw.extend([r, g, b, a])  # background
    
    idat = chunk(b'IDAT', zlib.compress(bytes(raw)))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

os.makedirs('assets', exist_ok=True)
png = create_png(1024, 1024, 0, 83, 193)
with open('assets/app_icon.png', 'wb') as f:
    f.write(png)
print(f'Created: assets/app_icon.png ({len(png)} bytes)')
