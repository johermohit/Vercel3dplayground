/**
 * Frame Analysis Utilities
 * Reusable functions for camera frame processing
 */

export interface FrameAnalysis {
    avgColor: { r: number; g: number; b: number };
    brightness: number; // 0-1
    timestamp: number;
}

/**
 * Analyze a video frame for color and brightness
 * Uses sampling for performance (not every pixel)
 */
export function analyzeFrame(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    sampleSize: number = 10 // Sample every Nth pixel for speed
): FrameAnalysis | null {
    if (video.readyState < video.HAVE_CURRENT_DATA) return null;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) return null;

    // Resize canvas to match video (can be smaller for performance)
    const scale = 0.25; // Process at 25% resolution
    canvas.width = width * scale;
    canvas.height = height * scale;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let totalR = 0, totalG = 0, totalB = 0;
    let totalBrightness = 0;
    let sampleCount = 0;

    // Sample pixels (skip some for performance)
    for (let i = 0; i < data.length; i += 4 * sampleSize) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        totalR += r;
        totalG += g;
        totalB += b;

        // Calculate perceived brightness (human eye weighted)
        totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        sampleCount++;
    }

    if (sampleCount === 0) return null;

    return {
        avgColor: {
            r: Math.round(totalR / sampleCount),
            g: Math.round(totalG / sampleCount),
            b: Math.round(totalB / sampleCount)
        },
        brightness: totalBrightness / sampleCount,
        timestamp: Date.now()
    };
}

/**
 * Convert RGB to HSL for more intuitive color info
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Get color name from RGB (simple categorization)
 */
export function getColorName(r: number, g: number, b: number): string {
    const { h, s, l } = rgbToHsl(r, g, b);

    if (l < 15) return 'Black';
    if (l > 85 && s < 20) return 'White';
    if (s < 15) return 'Gray';

    if (h < 15 || h >= 345) return 'Red';
    if (h < 45) return 'Orange';
    if (h < 75) return 'Yellow';
    if (h < 165) return 'Green';
    if (h < 195) return 'Cyan';
    if (h < 255) return 'Blue';
    if (h < 285) return 'Purple';
    if (h < 345) return 'Pink';

    return 'Unknown';
}
