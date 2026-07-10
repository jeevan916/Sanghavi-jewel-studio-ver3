import sys
import base64
import numpy as np
import cv2

def enhance_image():
    # Read base64 from stdin
    input_data = sys.stdin.read().strip()
    if not input_data:
        return
        
    # Decode base64 to bytes
    img_bytes = base64.b64decode(input_data)
    
    # Convert bytes to numpy array
    nparr = np.frombuffer(img_bytes, np.uint8)
    
    # Decode image
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return
        
    # 1. Normalize (Auto-contrast)
    # We can do this per channel or on the V channel. Let's do simple min-max per channel
    img_norm = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
    
    # 2. Modulate (Brightness * 1.05, Saturation * 1.15)
    hsv = cv2.cvtColor(img_norm, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:,:,1] = np.clip(hsv[:,:,1] * 1.15, 0, 255) # Saturation
    hsv[:,:,2] = np.clip(hsv[:,:,2] * 1.05, 0, 255) # Brightness
    img_mod = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    
    # 3. Sharpen (Unsharp mask with sigma 1.5)
    blurred = cv2.GaussianBlur(img_mod, (0, 0), 1.5)
    # addWeighted(src1, alpha, src2, beta, gamma)
    img_sharp = cv2.addWeighted(img_mod, 1.5, blurred, -0.5, 0)
    
    # Encode back to JPEG
    success, encoded_img = cv2.imencode('.jpg', img_sharp, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if success:
        out_base64 = base64.b64encode(encoded_img).decode('utf-8')
        print(out_base64)

if __name__ == '__main__':
    enhance_image()
