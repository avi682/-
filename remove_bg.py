from PIL import Image, ImageDraw
import os
import glob

def remove_background_floodfill(image_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        width, height = img.size
        
        # Get the color of the top-left pixel to define the background color
        bg_color = img.getpixel((0, 0))
        
        # If it's already transparent, we might need to check other corners or just skip
        # But assuming it's white/colored opaque based on user report
        if bg_color[3] == 0:
            print(f"Skipping {image_path}, corner already transparent.")
            return

        # Floodfill from corners to be safe (0,0), (w-1, 0), etc.
        # We'll creating a mask
        ImageDraw.floodfill(img, (0, 0), (0, 0, 0, 0), thresh=50) # thresh handles slight compression artifacts
        ImageDraw.floodfill(img, (width-1, 0), (0, 0, 0, 0), thresh=50)
        ImageDraw.floodfill(img, (0, height-1), (0, 0, 0, 0), thresh=50)
        ImageDraw.floodfill(img, (width-1, height-1), (0, 0, 0, 0), thresh=50)
        
        img.save(image_path, "PNG")
        print(f"Processed (Floodfill): {image_path}")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

# Process all pixel_*.png files
# Process all pixel_*.png files
files = glob.glob("pixel_*.png")
for f in files:
    # Process ALL pets including duck
    remove_background_floodfill(f)

    # Secondary pass: Force black to transparent if floodfill missed it
    try:
        img = Image.open(f).convert("RGBA")
        datas = img.getdata()
        new_data = []
        for item in datas:
            # If pixel is black (allowing slight variance), make it transparent
            if item[0] < 10 and item[1] < 10 and item[2] < 10:
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append(item)
        img.putdata(new_data)
        img.save(f, "PNG")
        print(f"Refined black removal: {f}")
    except Exception as e:
        print(f"Error refining {f}: {e}")
