from PIL import Image
import os

def analyze_image(path):
    try:
        img = Image.open(path)
        print(f"Analysis for {path}:")
        print(f"  Mode: {img.mode}")
        print(f"  Format: {img.format}")
        print(f"  Size: {img.size}")
        
        if img.mode == 'RGBA':
            # Check corners for transparency
            corners = [
                (0, 0),
                (img.width - 1, 0),
                (0, img.height - 1),
                (img.width - 1, img.height - 1)
            ]
            print("  Corner Pixels:")
            for c in corners:
                pixel = img.getpixel(c)
                print(f"    {c}: {pixel}")
                
            # Check for any non-transparent white-ish pixels
            # Count pixels that are "white" but opaque
            white_opaque = 0
            total_pixels = img.width * img.height
            for x in range(img.width):
                for y in range(img.height):
                    p = img.getpixel((x, y))
                    # Check if opaque (A > 0) and bright (R,G,B > 240)
                    if p[3] > 0 and p[0] > 240 and p[1] > 240 and p[2] > 240:
                        white_opaque += 1
            
            print(f"  Opaque White-ish Pixels: {white_opaque} / {total_pixels}")

    except Exception as e:
        print(f"Error analyzing {path}: {e}")

analyze_image("pixel_duck.png")
analyze_image("pixel_dragon.png")
analyze_image("pixel_lion.png")
