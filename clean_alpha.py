from PIL import Image
import glob

def clean_alpha_and_crop(image_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        # Threshold: if alpha is low, kill it.
        # Also, if it is "white" but barely visible, kill it.
        for item in datas:
            # item is (r, g, b, a)
            if item[3] < 50: # Aggressive threshold for noise
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append(item)
        
        img.putdata(new_data)
        
        # Now Crop again
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
            # Resize logic (keep aspect ratio, target height 64)
            # Actually, let's stick to the crop for now to see if the frame goes away
            # User wants NO FRAME.
            
            # If the duck is 48x48, let's try to fit closely.
            # But the most important thing is REMOVING THE NOISE.
            
            # Let's verify if the bounding box was actually smaller now
            print(f"Cleaned {image_path}: New Box {bbox}")
        
        img.save(image_path, "PNG")
        
    except Exception as e:
        print(f"Error cleaning {image_path}: {e}")

files = glob.glob("pixel_*.png")
for f in files:
    # Process all
    clean_alpha_and_crop(f)
