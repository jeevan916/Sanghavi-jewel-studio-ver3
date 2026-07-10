import sys
import base64
import numpy as np
import cv2

def enhance_image(input_path, output_path):
    try:
        sys.stderr.write(f"Python: Reading from {input_path}...\n")
        
        with open(input_path, 'r') as f:
            input_data = f.read().strip()
            
        if not input_data:
            sys.stderr.write("Error: Empty input\n")
            sys.exit(1)
            
        img_bytes = base64.b64decode(input_data)
        
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            sys.stderr.write("Error: cv2.imdecode returned None. Invalid image format.\n")
            sys.exit(1)
            
        img_norm = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
        
        hsv = cv2.cvtColor(img_norm, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[:,:,1] = np.clip(hsv[:,:,1] * 1.15, 0, 255) # Saturation
        hsv[:,:,2] = np.clip(hsv[:,:,2] * 1.05, 0, 255) # Brightness
        img_mod = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        
        blurred = cv2.GaussianBlur(img_mod, (0, 0), 1.5)
        img_sharp = cv2.addWeighted(img_mod, 1.5, blurred, -0.5, 0)
        
        success, encoded_img = cv2.imencode('.jpg', img_sharp, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if success:
            out_base64 = base64.b64encode(encoded_img).decode('utf-8')
            with open(output_path, 'w') as f:
                f.write(out_base64)
            sys.stderr.write("Python: Done.\n")
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
    enhance_image(sys.argv[1], sys.argv[2])
