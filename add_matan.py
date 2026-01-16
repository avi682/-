from PIL import Image
import os

src = "C:/Users/avi24/.gemini/antigravity/brain/d1a67163-0a17-42a2-b503-b2e6f982ac0a/uploaded_image_1768571461384.jpg"
dest = "pixel_matan.png"

def process_image(src, dest):
    try:
        img = Image.open(src).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        # Remove Black Background
        for item in datas:
            if item[0] < 20 and item[1] < 20 and item[2] < 20:
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append(item)
        
        img.putdata(new_data)
        
        # Crop
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        # Resize to 64px height
        base_height = 64
        w_percent = (base_height / float(img.size[1]))
        w_size = int((float(img.size[0]) * float(w_percent)))
        
        img = img.resize((w_size, base_height), Image.Resampling.NEAREST)
        
        img.save(dest, "PNG")
        print(f"Processed {src} -> {dest}")
        
    except Exception as e:
        print(f"Error: {e}")

process_image(src, dest)
