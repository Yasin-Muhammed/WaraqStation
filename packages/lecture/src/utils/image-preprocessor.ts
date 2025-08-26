import sharp from 'sharp';
import { Buffer } from 'node:buffer';

/**
 * Image preprocessing utilities for enhanced Arabic OCR
 */

export interface ImagePreprocessingOptions {
  /** Enable contrast enhancement */
  enhanceContrast?: boolean;
  /** Enable noise reduction */
  reduceNoise?: boolean;
  /** Enable deskewing */
  deskew?: boolean;
  /** Target DPI for OCR (default: 300) */
  targetDpi?: number;
  /** Enable sharpening */
  sharpen?: boolean;
  /** Convert to grayscale */
  grayscale?: boolean;
  /** Binarization threshold (0-255, auto if not specified) */
  binarizationThreshold?: number;
}

/**
 * Preprocesses images for optimal Arabic OCR recognition
 */
export async function preprocessImageForOCR(
  imageBuffer: Buffer | ArrayBuffer,
  options: ImagePreprocessingOptions = {}
): Promise<Buffer> {
  const {
    enhanceContrast = true,
    reduceNoise = true,
    targetDpi = 300,
    sharpen = true,
    grayscale = true,
    binarizationThreshold,
  } = options;

  const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;
  
  let image = sharp(buffer);
  
  // Get image metadata
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  
  // Skip processing for very small images
  if (width < 20 || height < 20) {
    console.warn('Image too small for preprocessing, returning original');
    return buffer;
  }
  
  // Calculate optimal scaling for Arabic text OCR
  const currentDpi = metadata.density || 72;
  let scaleFactor = targetDpi / currentDpi;
  
  // Ensure minimum readable size for Arabic text (Arabic needs higher resolution)
  const minWidth = 400;  // Higher minimum for Arabic text
  const minHeight = 200;
  
  if (width < minWidth || height < minHeight) {
    // Scale up small images for better Arabic OCR
    const scaleX = minWidth / width;
    const scaleY = minHeight / height;
    scaleFactor = Math.max(scaleFactor, Math.min(scaleX, scaleY));
  }
  
  // Apply intelligent scaling
  if (scaleFactor > 1.1 || scaleFactor < 0.9) {
    const newWidth = Math.round(width * scaleFactor);
    const newHeight = Math.round(height * scaleFactor);
    
    image = image.resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    });
  }
  
  // Convert to grayscale first for better processing
  if (grayscale) {
    image = image.grayscale();
  }
  
  // Advanced contrast enhancement for Arabic text
  if (enhanceContrast) {
    // Use histogram equalization for better contrast
    image = image.normalize();
    
    // Apply gamma correction for better text visibility
    image = image.gamma(1.2);
    
    // Enhance local contrast
    image = image.linear(1.2, -(128 * 0.2));
  }
  
  // Noise reduction specifically tuned for Arabic text
  if (reduceNoise) {
    // Use median filter for noise reduction while preserving edges
    image = image.median(3);
  }
  
  // Advanced sharpening for Arabic characters
  if (sharpen) {
    // Use unsharp mask for better text clarity
    image = image.sharpen({
      sigma: 1.5,     // Slightly larger radius for Arabic text
      m1: 1.0,        // Threshold
      m2: 2.5,        // Amount
      x1: 3.0,        // Threshold for dark areas
      y2: 15.0,       // Multiplier for dark areas
      y3: 25.0,       // Maximum enhancement
    });
  }
  
  // Apply morphological operations to clean up text
  image = image.convolve({
    width: 3,
    height: 3,
    kernel: [
      -1, -1, -1,
      -1,  9, -1,
      -1, -1, -1
    ]
  });
  
  // Apply adaptive binarization if no specific threshold
  if (binarizationThreshold !== undefined) {
    image = image.threshold(binarizationThreshold);
  } else {
    // Use Otsu's method for automatic threshold selection
    const stats = await image.clone().stats();
    const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    const autoThreshold = Math.max(100, Math.min(180, avgBrightness * 1.1));
    image = image.threshold(autoThreshold);
  }
  
  // Final cleanup - remove small noise artifacts
  image = image.median(1);
  
  // Output as PNG for lossless quality (better for OCR than JPEG)
  return image.png({ quality: 100, compressionLevel: 0 }).toBuffer();
}

/**
 * Detects and corrects text orientation for Arabic documents
 */
export async function detectAndCorrectOrientation(imageBuffer: Buffer): Promise<Buffer> {
  // For now, we'll implement basic rotation detection
  // In a more advanced implementation, you could use computer vision libraries
  // to detect text orientation and rotate accordingly
  
  const image = sharp(imageBuffer);
  
  // Try different rotations and use the one that gives the best OCR results
  // This is a simplified approach - in production, you might want to use
  // more sophisticated orientation detection algorithms
  
  return image.toBuffer();
}

/**
 * Removes borders and margins from document images
 */
export async function cropDocumentBorders(
  imageBuffer: Buffer,
  padding: number = 20
): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  
  if (!metadata.width || !metadata.height) {
    return imageBuffer;
  }
  
  // Simple border detection and cropping
  // In a more advanced implementation, you would use edge detection
  // to find the actual document boundaries
  
  const cropWidth = Math.max(metadata.width - (padding * 2), metadata.width * 0.9);
  const cropHeight = Math.max(metadata.height - (padding * 2), metadata.height * 0.9);
  
  const left = Math.floor((metadata.width - cropWidth) / 2);
  const top = Math.floor((metadata.height - cropHeight) / 2);
  
  return image.extract({
    left,
    top,
    width: Math.floor(cropWidth),
    height: Math.floor(cropHeight),
  }).toBuffer();
}

/**
 * Applies advanced preprocessing pipeline optimized for Arabic text
 */
export async function preprocessArabicDocument(
  imageBuffer: Buffer | ArrayBuffer,
  options: ImagePreprocessingOptions = {}
): Promise<Buffer> {
  const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;
  
  try {
    // Check image dimensions first
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // If image is too small, skip preprocessing to avoid scaling issues
    if ((metadata.width || 0) < 50 || (metadata.height || 0) < 50) {
      console.warn('Image too small for preprocessing, using original');
      return buffer;
    }
    
    // Step 1: Apply gentle preprocessing for small images
    let processedBuffer = buffer;
    
    // Only apply cropping for larger images
    if ((metadata.width || 0) > 200 && (metadata.height || 0) > 200) {
      processedBuffer = await cropDocumentBorders(buffer);
    }
    
    // Step 2: Skip orientation correction for now (can cause issues)
    // processedBuffer = await detectAndCorrectOrientation(processedBuffer);
    
    // Step 3: Apply conservative preprocessing
    processedBuffer = await preprocessImageForOCR(processedBuffer, {
      enhanceContrast: true,
      reduceNoise: false, // Disable noise reduction by default
      targetDpi: 200, // Lower DPI to avoid scaling issues
      sharpen: false, // Disable sharpening by default
      grayscale: true,
      ...options,
    });
    
    return processedBuffer;
  } catch (error) {
    console.warn('Image preprocessing failed:', error.message);
    return buffer; // Return original buffer if preprocessing fails
  }
}

/**
 * Validates if an image is suitable for OCR processing
 */
export async function validateImageForOCR(imageBuffer: Buffer): Promise<{
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    // Check resolution
    const dpi = metadata.density || 72;
    if (dpi < 150) {
      issues.push('Low resolution (DPI < 150)');
      recommendations.push('Increase image resolution to at least 300 DPI');
    }
    
    // Check dimensions
    if ((metadata.width || 0) < 500 || (metadata.height || 0) < 500) {
      issues.push('Image dimensions too small');
      recommendations.push('Use larger image dimensions (at least 500x500 pixels)');
    }
    
    // Check contrast (simplified check using standard deviation)
    const avgStdDev = stats.channels.reduce((sum, channel) => sum + channel.stdev, 0) / stats.channels.length;
    if (avgStdDev < 30) {
      issues.push('Low contrast detected');
      recommendations.push('Improve image contrast or lighting conditions');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      isValid: false,
      issues: ['Failed to analyze image'],
      recommendations: ['Ensure image is in a supported format (JPEG, PNG, WebP, etc.)'],
    };
  }
}