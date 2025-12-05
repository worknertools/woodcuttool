/* --- Woodcut Tool JavaScript (Optimized with Async Download Status) --- */

// ==========================================
// 1. Perlin 噪声辅助类和函数
// ==========================================
class Vector2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  dot(other) {
    return this.x * other.x + this.y * other.y;
  }}

function Shuffle(arrayToShuffle) {
  for (let e = arrayToShuffle.length - 1; e > 0; e--) {
    const index = Math.round(Math.random() * (e - 1));
    const temp = arrayToShuffle[e];
    arrayToShuffle[e] = arrayToShuffle[index];
    arrayToShuffle[index] = temp;
  }
}
function MakePermutation() {
  const permutation = [];
  for (let i = 0; i < 256; i++) {
    permutation.push(i);
  }
  Shuffle(permutation);
  for (let i = 0; i < 256; i++) {
    permutation.push(permutation[i]);
  }
  return permutation;
}
const Permutation = MakePermutation();
function GetConstantVector(v) {
  const h = v & 3;
  if (h === 0) return new Vector2(1.0, 1.0);else
  if (h === 1) return new Vector2(-1.0, 1.0);else
  if (h === 2) return new Vector2(-1.0, -1.0);else
  return new Vector2(1.0, -1.0);
}
function Fade(t) {
  return ((6 * t - 15) * t + 10) * t * t * t;
}
function Lerp(t, a1, a2) {
  return a1 + t * (a2 - a1);
}
function Noise2D(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const topRight = new Vector2(xf - 1.0, yf - 1.0);
  const topLeft = new Vector2(xf, yf - 1.0);
  const bottomRight = new Vector2(xf - 1.0, yf);
  const bottomLeft = new Vector2(xf, yf);
  const valueTopRight = Permutation[Permutation[X + 1] + Y + 1];
  const valueTopLeft = Permutation[Permutation[X] + Y + 1];
  const valueBottomRight = Permutation[Permutation[X + 1] + Y];
  const valueBottomLeft = Permutation[Permutation[X] + Y];
  const dotTopRight = topRight.dot(GetConstantVector(valueTopRight));
  const dotTopLeft = topLeft.dot(GetConstantVector(valueTopLeft));
  const dotBottomRight = bottomRight.dot(GetConstantVector(valueBottomRight));
  const dotBottomLeft = bottomLeft.dot(GetConstantVector(valueBottomLeft));
  const u = Fade(xf);
  const v = Fade(yf);
  return Lerp(u, Lerp(v, dotBottomLeft, dotTopLeft), Lerp(v, dotBottomRight, dotTopRight));
}

// ==========================================
// 2. 核心逻辑
// ==========================================
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) {
    return {
      addEventListener: () => {},
      value: null,
      style: {},
      classList: { add: () => {}, remove: () => {} },
      id: null,
      getContext: () => ({ fillRect: () => {}, clearRect: () => {}, drawImage: () => {}, getImageData: () => {return { data: [] };}, putImageData: () => {}, createLinearGradient: () => {return { addColorStop: () => {} };} }) };

  }
  return el;
}

// --- DOM Elements ---
const imageUpload = getEl('imageUpload');
const contentImg = getEl('contentImage');
const uploadArea = getEl('uploadArea');
const uploadPlaceholder = getEl('uploadPlaceholder');
const downloadPngButton = getEl('downloadPng');
const downloadJpgButton = getEl('downloadJpg');
const downloadSvgButton = getEl('downloadSvg');
const resetSettingsButton = getEl('resetSettings');
const thresholdSlider = getEl('threshold');
const thresholdValue = getEl('thresholdValue');
const edgeSlider = getEl('edgeStrength');
const edgeValue = getEl('edgeValue');
const smoothnessSlider = getEl('smoothness');
const smoothnessValue = getEl('smoothnessValue');
const detailSlider = getEl('detailLevel');
const detailValue = getEl('detailValue');
const backgroundColorInput = getEl('backgroundColor');
const foregroundColorInput = getEl('foregroundColor');
const bgDisplay = getEl('bgDisplay');
const fgDisplay = getEl('fgDisplay');
const styledCanvas = getEl('styledCanvas');
const originalCanvas = getEl('originalCanvas');
const colorPaletteSelect = getEl('colorPalette');
const stylePresetSelect = getEl('stylePreset');
const canvasStage = getEl('canvasStage');

// --- 新增：下载进度提示 DOM ---
const downloadStatusEl = getEl('downloadStatus');
const statusTextEl = getEl('statusText');

// --- Constants & State ---
const DEFAULT_BG = '#ffffff';
const DEFAULT_FG = '#53565c';
const DEFAULT_PALETTE = 'classic';
const DEFAULT_STYLE = 'graphic';
let selectedBgColor = DEFAULT_BG;
let selectedFgColor = DEFAULT_FG;
let originalImageData = null;
let fullImageData = null;
let maskData = null;
let updateScheduled = false;
let currentAspectRatio = '3:4';
const MAX_EXPORT_DIM = 4096;
const MAX_PREVIEW_DIM = 1024;

const colorPalettes = {
  classic: { bg: '#ffffff', fg: '#53565c' },
  'red-black': { bg: '#f5e6d3', fg: '#8b0000' },
  'blue-ochre': { bg: '#e8d5b7', fg: '#1e3a5f' },
  'green-sepia': { bg: '#ede5d8', fg: '#3a5f3a' },
  'chinese-red': { bg: '#f0e7d8', fg: '#c8102e' },
  'prussian-blue': { bg: '#e8e4d9', fg: '#003153' },
  'earth-tones': { bg: '#e9dcc9', fg: '#5d4e37' },
  'japanese-indigo': { bg: '#f0ece2', fg: '#264348' } };


const stylePresets = {
  graphic: { threshold: 50, edge: 3.0, smoothness: 30, detail: 50 },
  'vans-style': { threshold: 55, edge: 4.0, smoothness: 20, detail: 60 },
  'roche-style': { threshold: 47, edge: 2.5, smoothness: 40, detail: 45 },
  'rough-woodcut': { threshold: 51, edge: 5.0, smoothness: 10, detail: 30 } };


let scale = 1;
let dx = 0;
let dy = 0;
let isDragging = false;
let lastX, lastY;
let offscreenCanvas = document.createElement('canvas');
let offscreenCtx = offscreenCanvas.getContext('2d');

// --- Helper Functions for Loading Status ---
function showLoading(text) {
  if (statusTextEl.id) statusTextEl.textContent = text;
  if (downloadStatusEl.id) downloadStatusEl.classList.add('active');
}

function hideLoading() {
  if (downloadStatusEl.id) {
    // 稍微延迟消失，提供完成的视觉反馈
    setTimeout(() => {
      downloadStatusEl.classList.remove('active');
    }, 1000);
  }
}

// --- UI Updates ---
function updateUIValues() {
  if (thresholdSlider.id) thresholdValue.textContent = thresholdSlider.value;
  if (edgeSlider.id) edgeValue.textContent = edgeSlider.value;
  if (smoothnessSlider.id) smoothnessValue.textContent = smoothnessSlider.value;
  if (detailSlider.id) detailValue.textContent = detailSlider.value;
}
function updateCustomPickerVisuals() {
  if (backgroundColorInput.id && bgDisplay.id) {
    bgDisplay.style.backgroundColor = backgroundColorInput.value;
  }
  if (foregroundColorInput.id && fgDisplay.id) {
    fgDisplay.style.backgroundColor = foregroundColorInput.value;
  }
}
function updateCanvasBackground() {
  if (canvasStage.id) {
    canvasStage.style.backgroundColor = selectedBgColor;
  }
}
function calculateFitScale() {
  if (!offscreenCanvas.width || !offscreenCanvas.height) return 1;
  const imageW = offscreenCanvas.width;
  const imageH = offscreenCanvas.height;
  const canvasW = canvasStage.clientWidth;
  const canvasH = canvasStage.clientHeight;
  return Math.min(canvasW / imageW, canvasH / imageH);
}
function updateCanvasRatio() {
  if (!canvasStage.id) return;
  const ratio = currentAspectRatio;
  if (ratio === '4:3') {
    canvasStage.style.aspectRatio = '4 / 3';
    canvasStage.style.maxHeight = '65vh';
    canvasStage.style.maxWidth = 'calc(65vh * 1.333)';
  } else if (ratio === '1:1') {
    canvasStage.style.aspectRatio = '1 / 1';
    canvasStage.style.maxHeight = '80vh';
    canvasStage.style.maxWidth = '80vh';
  } else {
    canvasStage.style.aspectRatio = '3 / 4';
    canvasStage.style.maxHeight = '90vh';
    canvasStage.style.maxWidth = 'calc(90vh * 0.75)';
  }
  if (originalImageData) {
    scale = calculateFitScale();
    dx = 0;
    dy = 0;
  }
  updateDisplay();
}
function resetParametersToDefault() {
  selectedBgColor = DEFAULT_BG;
  selectedFgColor = DEFAULT_FG;
  if (colorPaletteSelect.id) colorPaletteSelect.value = DEFAULT_PALETTE;
  if (stylePresetSelect.id) stylePresetSelect.value = DEFAULT_STYLE;

  const defaultPreset = stylePresets[DEFAULT_STYLE];
  if (defaultPreset) {
    thresholdSlider.value = defaultPreset.threshold;
    edgeSlider.value = defaultPreset.edge;
    smoothnessSlider.value = defaultPreset.smoothness;
    detailSlider.value = defaultPreset.detail;
  }
  if (backgroundColorInput.id) backgroundColorInput.value = DEFAULT_BG;
  if (foregroundColorInput.id) foregroundColorInput.value = DEFAULT_FG;
  updateUIValues();
  updateCustomPickerVisuals();
  updateCanvasBackground();
}

// --- Utils ---
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
}
function scheduleUpdate(recomputeMask) {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    updateScheduled = false;
    if (originalImageData) {
      applyWoodcutEffect(recomputeMask);
    }
  });
}
function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return {
    r: bigint >> 16 & 255,
    g: bigint >> 8 & 255,
    b: bigint & 255 };

}

// --- Event Listeners ---
if (uploadArea.id) {
  uploadArea.addEventListener('click', () => imageUpload.click());
  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });
}
if (imageUpload.id) {
  imageUpload.addEventListener('change', e => {
    handleFile(e.target.files && e.target.files[0]);
    e.target.value = '';
  });
}
function handleFile(file) {
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        contentImg.src = event.target.result;
        contentImg.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
        uploadArea.classList.remove('empty');
        resetParametersToDefault();
        processImage(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
}
document.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAspectRatio = btn.dataset.ratio;
    updateCanvasRatio();
  });
});
if (colorPaletteSelect.id) {
  colorPaletteSelect.addEventListener('change', e => {
    const palette = colorPalettes[e.target.value];
    if (palette) {
      selectedBgColor = palette.bg;
      selectedFgColor = palette.fg;
      updateCanvasBackground();
      scheduleUpdate(false);
    }
  });
}
if (stylePresetSelect.id) {
  stylePresetSelect.addEventListener('change', e => {
    const preset = stylePresets[e.target.value];
    if (preset) {
      thresholdSlider.value = preset.threshold;
      edgeSlider.value = preset.edge;
      smoothnessSlider.value = preset.smoothness;
      detailSlider.value = preset.detail;
      updateUIValues();
      scheduleUpdate(true);
    }
  });
}
document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', e => {
    e.stopPropagation();
    const color = swatch.getAttribute('data-color');
    const target = swatch.getAttribute('data-for');
    if (!color || !target) return;

    if (target === 'bg') {
      selectedBgColor = color;
      updateCanvasBackground();
    } else if (target === 'fg') {
      selectedFgColor = color;
    }
    scheduleUpdate(false);
  });
});
if (backgroundColorInput.id) {
  backgroundColorInput.addEventListener('input', e => {
    selectedBgColor = e.target.value;
    updateCustomPickerVisuals();
    updateCanvasBackground();
    scheduleUpdate(false);
  });
}
if (foregroundColorInput.id) {
  foregroundColorInput.addEventListener('input', e => {
    selectedFgColor = e.target.value;
    updateCustomPickerVisuals();
    scheduleUpdate(false);
  });
}
const debouncedSliderUpdate = debounce(() => {
  updateUIValues();
  scheduleUpdate(true);
}, 150);

[thresholdSlider, edgeSlider, smoothnessSlider, detailSlider].forEach(slider => {
  if (slider.id) {
    slider.addEventListener('input', debouncedSliderUpdate);
  }
});
if (resetSettingsButton.id) {
  resetSettingsButton.addEventListener('click', () => {
    const currentRatio = currentAspectRatio;
    resetParametersToDefault();
    currentAspectRatio = currentRatio;
    document.querySelectorAll('.ratio-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.ratio === currentRatio);
    });
    updateCanvasRatio();

    originalImageData = null;
    fullImageData = null;
    maskData = null;
    contentImg.src = '';
    contentImg.style.display = 'none';
    uploadPlaceholder.style.display = 'flex';
    uploadArea.classList.add('empty');
    const ctx = styledCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, styledCanvas.width, styledCanvas.height);
    offscreenCanvas.width = 0;
    offscreenCanvas.height = 0;
    updateCanvasBackground();
    scale = 1;dx = 0;dy = 0;
  });
}

// --- Preview Logic ---
function processImage(img) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);
  fullImageData = tempCtx.getImageData(0, 0, img.width, img.height);
  let previewWidth = img.width;
  let previewHeight = img.height;
  if (img.width > MAX_PREVIEW_DIM || img.height > MAX_PREVIEW_DIM) {
    const ratio = img.width / img.height;
    if (ratio > 1) {
      previewWidth = MAX_PREVIEW_DIM;
      previewHeight = Math.round(img.height * MAX_PREVIEW_DIM / img.width);
    } else {
      previewHeight = MAX_PREVIEW_DIM;
      previewWidth = Math.round(img.width * MAX_PREVIEW_DIM / img.height);
    }
  }
  const ctx = originalCanvas.getContext('2d');
  if (!ctx) return;
  originalCanvas.width = previewWidth;
  originalCanvas.height = previewHeight;
  ctx.drawImage(img, 0, 0, previewWidth, previewHeight);
  originalImageData = ctx.getImageData(0, 0, previewWidth, previewHeight);

  maskData = null;
  dx = 0;dy = 0;

  applyWoodcutEffect(true);
  scale = calculateFitScale();
  updateDisplay();
}

function applyWoodcutEffect(recomputeMask = true) {
  if (!originalImageData) return;
  if (recomputeMask || !maskData) {
    const threshold = parseInt(thresholdSlider.value, 10);
    const edgeStrength = parseFloat(edgeSlider.value);
    const smoothness = parseInt(smoothnessSlider.value, 10);
    const detailLevel = parseInt(detailSlider.value, 10);
    const width = originalImageData.width;
    const height = originalImageData.height;
    let processedData = applyGaussianBlur(originalImageData.data, width, height, Math.floor(smoothness / 10));
    processedData = applySobel(processedData, width, height, edgeStrength);
    processedData = applyAdaptiveThreshold(processedData, width, height, threshold, detailLevel);
    processedData = applyMorphology(processedData, width, height, 'open', 1);
    maskData = processedData;
  }
  if (!maskData) return;
  const width = originalImageData.width;
  const height = originalImageData.height;
  const fgRgb = hexToRgb(selectedFgColor);

  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const outputData = offscreenCtx.createImageData(width, height);
  const isRoughStyle = stylePresetSelect.value === 'rough-woodcut';

  if (isRoughStyle) {
    const detailLevel = parseInt(detailSlider.value, 10) || 30;
    const textureScale = 60 / Math.max(1, detailLevel);
    const inkFactor = 0.05;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const isMaskBlack = maskData[i] < 128;
        const woodcutNoise = (Noise2D(x / textureScale, y / textureScale) + 1) / 2;
        let isInk = false;
        if (isMaskBlack) {
          if (Math.random() > inkFactor * 0.5) {
            isInk = true;
          }
          if (woodcutNoise > 0.85 && Math.random() < 0.3) {
            isInk = false;
          }
        } else {
          if (woodcutNoise > 0.92 && Math.random() < 0.1) {
            isInk = true;
          }
        }
        if (isInk) {
          outputData.data[i] = fgRgb.r;
          outputData.data[i + 1] = fgRgb.g;
          outputData.data[i + 2] = fgRgb.b;
          outputData.data[i + 3] = 255;
        } else {
          outputData.data[i] = 0;
          outputData.data[i + 1] = 0;
          outputData.data[i + 2] = 0;
          outputData.data[i + 3] = 0;
        }
      }
    }
  } else {
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i] < 128) {
        outputData.data[i] = fgRgb.r;
        outputData.data[i + 1] = fgRgb.g;
        outputData.data[i + 2] = fgRgb.b;
        outputData.data[i + 3] = 255;
      } else {
        outputData.data[i] = 0;
        outputData.data[i + 1] = 0;
        outputData.data[i + 2] = 0;
        outputData.data[i + 3] = 0;
      }
    }
  }
  offscreenCtx.putImageData(outputData, 0, 0);
  updateDisplay();
}
function updateDisplay() {
  if (!styledCanvas) return;
  const w = canvasStage.clientWidth;
  const h = canvasStage.clientHeight;
  styledCanvas.width = w;
  styledCanvas.height = h;
  const ctx = styledCanvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.clearRect(0, 0, w, h);
  if (!offscreenCanvas.width) return;
  ctx.save();
  ctx.translate(w / 2 + dx, h / 2 + dy);
  ctx.scale(scale, scale);
  ctx.translate(-offscreenCanvas.width / 2, -offscreenCanvas.height / 2);
  ctx.drawImage(offscreenCanvas, 0, 0);
  ctx.restore();
}

// --- Image Processing Algorithms ---
function applyGaussianBlur(data, w, h, r) {
  if (r < 1) return new Uint8ClampedArray(data);
  const output = new Uint8ClampedArray(data.length);
  const size = r * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - r;
    kernel[i] = Math.exp(-(x * x) / (2 * r * r));
    sum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  const temp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let tr = 0,tg = 0,tb = 0;
      for (let k = -r; k <= r; k++) {
        const px = Math.min(w - 1, Math.max(0, x + k));
        const idx = (y * w + px) * 4;
        const weight = kernel[k + r];
        tr += data[idx] * weight;
        tg += data[idx + 1] * weight;
        tb += data[idx + 2] * weight;
      }
      const i = (y * w + x) * 4;
      temp[i] = tr;temp[i + 1] = tg;temp[i + 2] = tb;temp[i + 3] = data[i + 3];
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let tr = 0,tg = 0,tb = 0;
      for (let k = -r; k <= r; k++) {
        const py = Math.min(h - 1, Math.max(0, y + k));
        const idx = (py * w + x) * 4;
        const weight = kernel[k + r];
        tr += temp[idx] * weight;
        tg += temp[idx + 1] * weight;
        tb += temp[idx + 2] * weight;
      }
      const i = (y * w + x) * 4;
      output[i] = tr;output[i + 1] = tg;output[i + 2] = tb;output[i + 3] = temp[i + 3];
    }
  }
  return output;
}
function applySobel(data, w, h, str) {
  const output = new Uint8ClampedArray(data.length);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let px = 0,py = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * w + (x + kx)) * 4;
          const val = data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
          const k = (ky + 1) * 3 + (kx + 1);
          px += gx[k] * val;
          py += gy[k] * val;
        }
      }
      let edge = Math.sqrt(px * px + py * py) * str;
      edge = Math.min(255, Math.max(0, edge));
      const val = edge > 80 ? 255 : 0;
      const i = (y * w + x) * 4;
      output[i] = output[i + 1] = output[i + 2] = val;
      output[i + 3] = data[i + 3];
    }
  }
  return output;
}
function applyAdaptiveThreshold(data, w, h, thresh, detail) {
  const output = new Uint8ClampedArray(data.length);
  let nDetail = detail > 10 ? Math.ceil(detail / 20) : detail;
  nDetail = Math.max(1, Math.min(5, nDetail));
  const blockSize = Math.max(3, 7 - nDetail);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0,count = 0;
      for (let ky = -blockSize; ky <= blockSize; ky++) {
        for (let kx = -blockSize; kx <= blockSize; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const idx = (py * w + px) * 4;
          sum += data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
          count++;
        }
      }
      const mean = sum / count;
      const localTh = mean * (0.5 + thresh / 100);
      const idx = (y * w + x) * 4;
      const lum = data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
      const val = lum >= localTh * 0.9 ? 255 : 0;
      output[idx] = output[idx + 1] = output[idx + 2] = val;
      output[idx + 3] = data[idx + 3];
    }
  }
  return output;
}
function applyMorphology(data, w, h, op, size) {
  const process = (inp, mode) => {
    const out = new Uint8ClampedArray(inp.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let val = mode === 'erode' ? 255 : 0;
        for (let ky = -size; ky <= size; ky++) {
          for (let kx = -size; kx <= size; kx++) {
            const px = Math.min(w - 1, Math.max(0, x + kx));
            const py = Math.min(h - 1, Math.max(0, y + ky));
            const v = inp[(py * w + px) * 4];
            if (mode === 'erode') val = Math.min(val, v);else
            val = Math.max(val, v);
          }
        }
        const i = (y * w + x) * 4;
        out[i] = out[i + 1] = out[i + 2] = val;
        out[i + 3] = inp[i + 3];
      }
    }
    return out;
  };
  if (op === 'open') return process(process(data, 'erode'), 'dilate');
  if (op === 'close') return process(process(data, 'dilate'), 'erode');
  return data;
}

// --- RASTER EXPORT (PNG/JPG) - Async Optimized ---
function exportRasterImage(type, filename) {
  // 使用 Promise 和 setTimeout 让 UI 先渲染出“正在处理”，避免页面假死
  return new Promise(resolve => {
    setTimeout(() => {
      if (!fullImageData) {
        alert('请先上传图片');
        resolve(false);
        return;
      }

      try {
        const scaleFactor = fullImageData.width / originalImageData.width;
        const baseSmoothness = parseInt(smoothnessSlider.value, 10);
        const scaledSmoothness = Math.floor(baseSmoothness / 10 * scaleFactor);
        const scaledMorphSize = Math.max(1, Math.floor(1 * scaleFactor));
        const th = parseInt(thresholdSlider.value, 10);
        const ed = parseFloat(edgeSlider.value);
        const dt = parseInt(detailSlider.value, 10);

        // 1. 生成基础 Mask (高分辨率计算，比较耗时)
        let processed = applyGaussianBlur(fullImageData.data, fullImageData.width, fullImageData.height, scaledSmoothness);
        processed = applySobel(processed, fullImageData.width, fullImageData.height, ed);
        processed = applyAdaptiveThreshold(processed, fullImageData.width, fullImageData.height, th, dt);
        processed = applyMorphology(processed, fullImageData.width, fullImageData.height, 'open', scaledMorphSize);

        const ratioParts = currentAspectRatio.split(':');
        const aspect = parseInt(ratioParts[0]) / parseInt(ratioParts[1]);
        let eW, eH;
        if (aspect >= 1) {eW = MAX_EXPORT_DIM;eH = Math.round(eW / aspect);} else
        {eH = MAX_EXPORT_DIM;eW = Math.round(eH * aspect);}

        const cvs = document.createElement('canvas');
        cvs.width = eW;cvs.height = eH;
        const ctx = cvs.getContext('2d');
        if (type === 'image/jpeg') {ctx.fillStyle = selectedBgColor;ctx.fillRect(0, 0, eW, eH);}

        const offCvs = document.createElement('canvas');
        offCvs.width = fullImageData.width;offCvs.height = fullImageData.height;
        const offCtx = offCvs.getContext('2d');
        const imgData = offCtx.createImageData(fullImageData.width, fullImageData.height);
        const fg = hexToRgb(selectedFgColor);

        // 2. 渲染
        const isRoughStyle = stylePresetSelect.value === 'rough-woodcut';

        if (isRoughStyle) {
          const textureScale = 60 / Math.max(1, dt);
          const inkFactor = 0.05;
          for (let i = 0; i < processed.length; i += 4) {
            const idx = i / 4;
            const x = idx % fullImageData.width;
            const y = Math.floor(idx / fullImageData.width);
            const isMaskBlack = processed[i] < 128;
            const woodcutNoise = (Noise2D(x / textureScale, y / textureScale) + 1) / 2;
            let isInk = false;
            if (isMaskBlack) {
              if (Math.random() > inkFactor * 0.5) isInk = true;
              if (woodcutNoise > 0.85 && Math.random() < 0.3) isInk = false;
            } else {
              if (woodcutNoise > 0.92 && Math.random() < 0.1) isInk = true;
            }
            if (isInk) {
              imgData.data[i] = fg.r;imgData.data[i + 1] = fg.g;imgData.data[i + 2] = fg.b;imgData.data[i + 3] = 255;
            } else {
              imgData.data[i + 3] = 0;
            }
          }
        } else {
          for (let i = 0; i < processed.length; i += 4) {
            if (processed[i] < 128) {
              imgData.data[i] = fg.r;imgData.data[i + 1] = fg.g;imgData.data[i + 2] = fg.b;imgData.data[i + 3] = 255;
            } else {
              imgData.data[i + 3] = 0;
            }
          }
        }
        offCtx.putImageData(imgData, 0, 0);

        const fit = Math.min(eW / fullImageData.width, eH / fullImageData.height);
        const dw = fullImageData.width * fit;
        const dh = fullImageData.height * fit;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offCvs, (eW - dw) / 2, (eH - dh) / 2, dw, dh);

        const link = document.createElement('a');
        link.download = filename;
        link.href = cvs.toDataURL(type, 0.95);
        link.click();

        resolve(true);
      } catch (error) {
        console.error(error);
        alert("生成图片时出错");
        resolve(false);
      }
    }, 100);
  });
}

// 修改事件监听器，调用 Loading 逻辑
if (downloadPngButton.id) {
  downloadPngButton.addEventListener('click', async () => {
    showLoading('正在处理 PNG，请稍候...');
    await exportRasterImage('image/png', `woodcut_export_${Date.now()}.png`);
    hideLoading();
  });
}
if (downloadJpgButton.id) {
  downloadJpgButton.addEventListener('click', async () => {
    showLoading('正在处理 JPG，请稍候...');
    await exportRasterImage('image/jpeg', `woodcut_export_${Date.now()}.jpg`);
    hideLoading();
  });
}

// --- SVG EXPORT ---
function traceBitmapToSVGPath(maskData, width, height) {
  const w = width;
  const h = height;
  const grid = new Uint8Array(w * h);
  for (let i = 0; i < maskData.length; i += 4) {
    grid[i / 4] = maskData[i] < 128 ? 1 : 0;
  }
  const getVal = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return grid[y * w + x];
  };
  const visitedVertical = new Uint8Array((w + 1) * h);
  let pathString = "";
  function getSmoothPathData(points) {
    if (points.length < 2) return "";
    let d = "";
    const p0 = points[0];
    const p1 = points[1];
    const startX = (p0.x + p1.x) / 2;
    const startY = (p0.y + p1.y) / 2;
    d += `M${startX.toFixed(2)},${startY.toFixed(2)} `;
    const len = points.length;
    for (let i = 1; i < len; i++) {
      const p = points[i];
      const nextP = points[(i + 1) % len];
      const endX = (p.x + nextP.x) / 2;
      const endY = (p.y + nextP.y) / 2;
      d += `Q${p.x},${p.y} ${endX.toFixed(2)},${endY.toFixed(2)} `;
    }
    const lastP = points[0];
    d += `Q${lastP.x},${lastP.y} ${startX.toFixed(2)},${startY.toFixed(2)}Z `;
    return d;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x <= w; x++) {
      const pLeft = getVal(x - 1, y);
      const pRight = getVal(x, y);
      if (pLeft !== pRight && !visitedVertical[y * (w + 1) + x]) {
        let points = [];
        let currX = x,currY = y;
        let dx = 0,dy = pLeft === 1 ? -1 : 1;
        const startX = currX,startY = currY;
        points.push({ x: currX, y: currY });
        if (dx === 0) {
          const markY = dy === 1 ? currY : currY - 1;
          if (markY >= 0 && markY < h) visitedVertical[markY * (w + 1) + currX] = 1;
        }
        let loopSafe = 0;
        const maxLoops = w * h * 4;
        let lastDx = dx,lastDy = dy;
        do {
          const tryDirs = [
          { dx: dy, dy: -dx },
          { dx: dx, dy: dy },
          { dx: -dy, dy: dx }];

          let moveFound = false;
          for (let d of tryDirs) {
            let l, r;
            if (d.dx === 1) {l = getVal(currX, currY - 1);r = getVal(currX, currY);} else
            if (d.dx === -1) {l = getVal(currX - 1, currY);r = getVal(currX - 1, currY - 1);} else
            if (d.dy === 1) {l = getVal(currX, currY);r = getVal(currX - 1, currY);} else
            {l = getVal(currX - 1, currY - 1);r = getVal(currX, currY - 1);}
            if (l === 1 && r === 0) {
              dx = d.dx;dy = d.dy;moveFound = true;break;
            }
          }
          if (!moveFound) {dx = -dx;dy = -dy;}
          currX += dx;currY += dy;
          if (dx === lastDx && dy === lastDy) {
            points[points.length - 1].x = currX;
            points[points.length - 1].y = currY;
          } else {
            points.push({ x: currX, y: currY });
          }
          lastDx = dx;lastDy = dy;
          if (dx === 0) {
            const vy = dy === 1 ? currY - 1 : currY;
            if (currX >= 0 && currX <= w && vy >= 0 && vy < h) {
              visitedVertical[vy * (w + 1) + currX] = 1;
            }
          }
          loopSafe++;
        } while ((currX !== startX || currY !== startY) && loopSafe < maxLoops);
        if (points.length > 2) {
          pathString += getSmoothPathData(points);
        }
      }
    }
  }
  return pathString;
}

if (downloadSvgButton.id) {
  downloadSvgButton.addEventListener('click', () => {
    if (!maskData || !originalImageData) return alert('请先上传图片');

    showLoading('正在生成矢量路径，请稍候...');

    // 使用 setTimeout 避免 SVG 计算完全阻塞 UI
    setTimeout(() => {
      try {
        const w = originalImageData.width;
        const h = originalImageData.height;
        const pathData = traceBitmapToSVGPath(maskData, w, h);
        const ratioParts = currentAspectRatio.split(':');
        const aspect = parseInt(ratioParts[0]) / parseInt(ratioParts[1]);
        let eW, eH;
        if (aspect >= 1) {eW = MAX_EXPORT_DIM;eH = Math.round(eW / aspect);} else
        {eH = MAX_EXPORT_DIM;eW = Math.round(eH * aspect);}
        const fitScale = Math.min(eW / w, eH / h);
        const tx = (eW - w * fitScale) / 2;
        const ty = (eH - h * fitScale) / 2;
        const svg = `
<svg width="${eW}" height="${eH}" viewBox="0 0 ${eW} ${eH}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
    <rect width="100%" height="100%" fill="${selectedBgColor}" />
    <g transform="translate(${tx}, ${ty}) scale(${fitScale})">
        <path d="${pathData}" fill="${selectedFgColor}" fill-rule="evenodd"/>
    </g>
</svg>`;
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;a.download = 'woodcut-smooth.svg';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert("SVG 生成失败");
      } finally {
        hideLoading();
      }
    }, 50);
  });
}

// --- Init ---
updateUIValues();
updateCustomPickerVisuals();
updateCanvasBackground();
initializeStylePresets();

function initializeStylePresets() {
  if (!stylePresetSelect.id) return;
  stylePresetSelect.innerHTML = '';
  const names = {
    graphic: '图形风格',
    'vans-style': 'VANS风格',
    'roche-style': 'Roche风格',
    'rough-woodcut': '粗糙木刻(纹理)' };

  for (const key in stylePresets) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = names[key] || key;
    stylePresetSelect.appendChild(opt);
  }
  stylePresetSelect.value = DEFAULT_STYLE;
}

canvasStage.addEventListener('mousedown', e => {isDragging = true;lastX = e.clientX;lastY = e.clientY;canvasStage.style.cursor = 'grabbing';});
canvasStage.addEventListener('mousemove', e => {if (isDragging) {dx += e.clientX - lastX;dy += e.clientY - lastY;lastX = e.clientX;lastY = e.clientY;updateDisplay();}});
canvasStage.addEventListener('mouseup', () => {isDragging = false;canvasStage.style.cursor = 'grab';});
canvasStage.addEventListener('mouseleave', () => {isDragging = false;canvasStage.style.cursor = 'grab';});
window.addEventListener('resize', updateDisplay);