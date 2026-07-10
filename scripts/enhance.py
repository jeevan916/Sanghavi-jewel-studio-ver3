import sys
import base64
import numpy as np
import cv2
import time

def enhance_image():
    sys.stderr.write("Python: Starting enhancement...\n")
    # Read base64 from stdin
    input_data = sys.stdin.read().strip()
    sys.stderr.write(f"Python: Read {len(input_data)} bytes\n")
    if not input_data:
        sys.stderr.write("Error: Empty input\n")
        sys.exit(1)
        
    try:
        sys.stderr.write("Python: Decoding base64...\n")
        img_bytes = base64.b64decode(input_data)
        sys.stderr.write(f"Python: Decoded to {len(img_bytes)} bytes\n")
    except Exception as e:
        sys.stderr.write(f"Error decoding base64: {str(e)}\n")
        sys.exit(1)
    
    sys.stderr.write("Python: Creating numpy array...\n")
    nparr = np.frombuffer(img_bytes, np.uint8)
    
    sys.stderr.write("Python: cv2.imdecode...\n")
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        sys.stderr.write("Error: cv2.imdecode returned None. Invalid image format.\n")
        sys.exit(1)
    sys.stderr.write(f"Python: Image shape {img.shape}\n")
        
    try:
        sys.stderr.write("Python: Normalize...\n")
        img_norm = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
        
        sys.stderr.write("Python: Modulate...\n")
        hsv = cv2.cvtColor(img_norm, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[:,:,1] = np.clip(hsv[:,:,1] * 1.15, 0, 255) # Saturation
        hsv[:,:,2] = np.clip(hsv[:,:,2] * 1.05, 0, 255) # Brightness
        img_mod = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        
        sys.stderr.write("Python: Sharpen (Gaussian blur)...\n")
        blurred = cv2.GaussianBlur(img_mod, (0, 0), 1.5)
        sys.stderr.write("Python: Sharpen (addWeighted)...\n")
        img_sharp = cv2.addWeighted(img_mod, 1.5, blurred, -0.5, 0)
        
        sys.stderr.write("Python: Encode...\n")
        success, encoded_img = cv2.imencode('.jpg', img_sharp, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if success:
            sys.stderr.write(f"Python: Encoded to {len(encoded_img)} bytes, sending to stdout...\n")
            out_base64 = base64.b64encode(encoded_img).decode('utf-8')
            sys.stdout.write(out_base64)
            sys.stdout.flush()
            sys.stderr.write("Python: Done.\n")
        else:
            sys.stderr.write("Error: Failed to encode output image\n")
            sys.exit(1)
            
    except Exception as e:
        sys.stderr.write(f"Processing error: {str(e)}\n")
        sys.exit(1)

if __name__ == '__main__':
    enhance_image()
