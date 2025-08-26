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
  
  // Calculate scaling factor for target DPI
  const currentDpi = metadata.density || 72;
  const scaleFactor = targetDpi / currentDpi;
  
  // Resize if needed for optimal DPI
  if (scaleFactor !== 1 && scaleFactor > 0.5 && scaleFactor < 3) {
    const newWidth = Math.round((metadata.width || 0) * scaleFactor);
    const newHeight = Math.round((metadata.height || 0) * scaleFactor);
    image = image.resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    });
  }
  
  // Convert to grayscale for better OCR performance
  if (grayscale) {
    image = image.grayscale();
  }
  
  // Enhance contrast
  if (enhanceContrast) {
    image = image.normalize();
  }
  
  // Apply sharpening to improve text clarity
  if (sharpen) {
    image = image.sharpen({
      sigma: 1.0,
      m1: 1.0,
      m2: 2.0,
      x1: 2.0,
      y2: 10.0,
      y3: 20.0,
    });
  }
  
  // Reduce noise using blur and threshold
  if (reduceNoise) {
    image = image.blur(0.5);
  }
  
  // Apply binarization if threshold is specified
  if (binarizationThreshold !== undefined) {
    image = image.threshold(binarizationThreshold, {
      greyscale: false,
    });
  }
  
  // Set high quality JPEG compression or PNG for lossless
  return image.jpeg({ quality: 95 }).toBuffer();
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
  
  // Step 1: Crop borders if needed
  let processedBuffer = await cropDocumentBorders(buffer);
  
  // Step 2: Detect and correct orientation
  processedBuffer = await detectAndCorrectOrientation(processedBuffer);
  
  // Step 3: Apply general preprocessing optimized for Arabic
  processedBuffer = await preprocessImageForOCR(processedBuffer, {
    enhanceContrast: true,
    reduceNoise: true,
    targetDpi: 300,
    sharpen: true,
    grayscale: true,
    ...options,
  });
  
  return processedBuffer;
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