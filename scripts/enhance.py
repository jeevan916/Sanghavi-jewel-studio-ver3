import sys
import numpy as np
import cv2

def enhance_webp_jewelry(input_webp_path, output_webp_path):
    try:
        # 1. OpenCV natively decodes WebP images into standard BGR arrays
        img = cv2.imread(input_webp_path)
        if img is None:
            sys.stderr.write("Error: Could not open or find the WebP image.\n")
            sys.exit(1)

        # 2. LIGHTING: Balance mobile highlights and shadows via LAB Space
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        
        # Strict contrast limit keeps gold/diamonds from blooming out into flat white blocks
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l_channel)
        
        lighting_corrected = cv2.merge((cl, a_channel, b_channel))
        img_hdr = cv2.cvtColor(lighting_corrected, cv2.COLOR_LAB2BGR)
        
        # 3. COLOR GRADING: Polish metals & neutralize indoor mobile phone yellow tint
        matrix = np.array([
            [1.05, 0.0, 0.0],  # Subtle blue boost to make silver/diamonds look crisp and clean
            [0.0, 1.02, 0.0],  # Balanced green
            [0.0, 0.0, 1.02]   # Balanced red
        ])
        color_graded = cv2.transform(img_hdr, matrix)
        
        # 4. SHARPNESS SCIENCE: High-pass filter to trace gemstone facet lines
        gaussian_blur = cv2.GaussianBlur(color_graded, (0, 0), 2.0)
        final_jewelry = cv2.addWeighted(color_graded, 1.7, gaussian_blur, -0.7, 0)
        
        # 5. SERVER SAVE: Write back to WebP with controlled quality parameters
        # CV2_IMWRITE_WEBP_QUALITY tells the server to avoid aggressive compressing (Value: 0-100)
        # 90-95 is the sweet spot for keeping diamond edges perfectly sharp
        success = cv2.imwrite(output_webp_path, final_jewelry, [int(cv2.IMWRITE_WEBP_QUALITY), 92])
        if success:
            sys.stderr.write(f"WebP jewelry photo successfully polished and saved to {output_webp_path}\n")
        else:
            sys.stderr.write("Error: Failed to encode output image\n")
            sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Processing error: {str(e)}\n")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: python3 enhance.py <input_path> <output_path>\n")
        sys.exit(1)
    enhance_webp_jewelry(sys.argv[1], sys.argv[2])
