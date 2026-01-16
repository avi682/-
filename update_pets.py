from PIL import Image
import os

# Map uploaded files to target names
mapping = {
    "uploaded_image_0_1768571175365.jpg": "pixel_cow.png",
    "uploaded_image_1_1768571175365.jpg": "pixel_snake.png",
    "uploaded_image_2_1768571175365.jpg": "pixel_wolf.png",
    "uploaded_image_3_1768571175365.jpg": "pixel_cat.png",
    "uploaded_image_4_1768571175365.jpg": "pixel_dragon.png"
}

def process_image(src, dest):
    try:
        if not os.path.exists(src):
            print(f"File not found: {src}")
            return # Skip if file doesn't exist (e.g. testing)

        img = Image.open(src).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        # Remove Black Background (0,0,0) +/- tolerance
        for item in datas:
            # item is (r, g, b, a)
            # Check if blackish
            if item[0] < 10 and item[1] < 10 and item[2] < 10:
                new_data.append((0, 0, 0, 0)) # Transparent
            else:
                new_data.append(item)
        
        img.putdata(new_data)
        
        # Trim (Crop)
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        # Resize to standard height (e.g. 64px) to match Duck
        base_height = 64
        w_percent = (base_height / float(img.size[1]))
        w_size = int((float(img.size[0]) * float(w_percent)))
        
        img = img.resize((w_size, base_height), Image.Resampling.NEAREST)
        
        img.save(dest, "PNG")
        print(f"Processed {src} -> {dest}")
        
    except Exception as e:
        print(f"Error processing {src}: {e}")

# Process files
for src, dest in mapping.items():
    # Helper to find the absolute path if needed, but assuming cwd
    # The uploaded files are likely in the brain dir, I need to copy them or read them from there.
    # Actually, the user says "uploaded 5 images", usually they are available in the cwd or I need to move them.
    # The metadata says they are in C:/Users/avi24/.gemini/antigravity/brain/...
    # I will assume I need to read them from the artifacts directory.
    
    # Let's try to locate them.
    # Since I cannot easily guess the full path without `dir`, I'll rely on the paths provided in metadata.
    pass 

if __name__ == "__main__":
    # We will use the absolute paths from the metadata directly in the function calls
    # I'll paste them here for the execution
    
    base_path = "C:/Users/avi24/.gemini/antigravity/brain/d1a67163-0a17-42a2-b503-b2e6f982ac0a/"
    
    files = {
        "uploaded_image_0_1768571175365.jpg": "pixel_cow.png",
        "uploaded_image_1_1768571175365.jpg": "pixel_snake.png",
        "uploaded_image_2_1768571175365.jpg": "pixel_wolf.png",
        "uploaded_image_3_1768571175365.jpg": "pixel_cat.png",
        "uploaded_image_4_1768571175365.jpg": "pixel_dragon.png"
    }

    for f_in, f_out in files.items():
        process_image(base_path + f_in, f_out)
