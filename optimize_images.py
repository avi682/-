from PIL import Image
import os
import glob

def optimize_image(image_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        
        # 1. Get Bounding Box (Trim)
        bbox = img.getbbox()
        if not bbox:
            print(f"Skipping {image_path}, completely transparent.")
            return

        img_cropped = img.crop(bbox)
        
        # 2. Resize to verify 'pixel art' look
        # Duck is 256x256, but likely rendered at 48x48.
        # Let's target a height of 64px for good quality scaling
        base_height = 64
        w_percent = (base_height / float(img_cropped.size[1]))
        w_size = int((float(img_cropped.size[0]) * float(w_percent)))
        
        # Use NEAREST for pixel art crispness
        img_resized = img_cropped.resize((w_size, base_height), Image.Resampling.NEAREST)
        
        img_resized.save(image_path, "PNG")
        print(f"Optimized {image_path}: Orig {img.size} -> Crop {img_cropped.size} -> Resize {img_resized.size}")
        
    except Exception as e:
        print(f"Error optimizing {image_path}: {e}")

files = glob.glob("pixel_*.png")
for f in files:
    if "duck" in f:
        print(f"Skipping duck: {f}")
        continue
    optimize_image(f)
