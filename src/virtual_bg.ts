import * as bodyPix from '@tensorflow-models/body-pix';
import { getBackend } from '@tensorflow/tfjs';
import { Color } from '@tensorflow-models/body-pix/dist/types';
import { PersonInferenceConfig, ModelConfig } from '@tensorflow-models/body-pix/dist/body_pix_model';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

const MODEL_OPTION: { [key: string]: ModelConfig; } = {
  lowEnd: {
    architecture: 'MobileNetV1',
    outputStride: 8,
    multiplier: 0.5,
    quantBytes: 1,
  },
  low: {
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
  },
  middle: {
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 1.0,
    quantBytes: 2,
  },
  high: {
    architecture: 'ResNet50',
    outputStride: 16,
    multiplier: 1.0,
    quantBytes: 2,
  },
  highEnd: {
    architecture: 'ResNet50',
    outputStride: 32,
    multiplier: 1.0,
    quantBytes: 4,
  },
};

export interface IModelOptions {
  modelOption?: 'lowEnd' | 'low' | 'middle' | 'high' | 'highEnd';
  segmentOption?: PersonInferenceConfig;
  drawOption?: {
    /** 単色マスクの不透明度 */
    opacity?: number,
    /** 単色マスクの色 */
    bgColor?: Color,
    /** (0 ~ 20) 人物と背景間のエッジをぼかすピクセル数 */
    edgeBlurAmount?: number;
    /** 反転 */
    flipHorizontal?: boolean;
    /** (1 ~ 20) ぼかし具合 */
    backgroundBlurAmount?: number;
  }
}

export class VirtualBgClass {
  private _net: bodyPix.BodyPix;
  private _segmentOption: PersonInferenceConfig;
  private _drawOption: IModelOptions['drawOption'];
  private _animationId: number;
  private _isAnimate = false;
  private _mainCanvas: HTMLCanvasElement;
  private _mainCtx: CanvasRenderingContext2D;
  private _video = document.createElement('video');
  private _bgCanvas = document.createElement('canvas');
  private _bgCtx = this._bgCanvas.getContext('2d');
  public _effectType = 'image';
  public _bgImage: HTMLImageElement;

  /** 描画するcanvas、背景画像、body-pixのオプションを渡してください */
  constructor(canvas: HTMLCanvasElement, bgImage: HTMLImageElement, option: IModelOptions) {
    this._segmentOption = option.segmentOption;
    this._drawOption = option.drawOption;
    this._mainCanvas = canvas;
    this._mainCtx = this._mainCanvas.getContext('2d');
    this._mainCanvas.width = VIDEO_WIDTH;
    this._mainCanvas.height = VIDEO_HEIGHT;
    this._video.width = VIDEO_WIDTH;
    this._video.height = VIDEO_HEIGHT;
    this._bgCanvas.width = VIDEO_WIDTH;
    this._bgCanvas.height = VIDEO_HEIGHT;
    this._bgImage = bgImage;
    getBackend();
    this.startVideo(option.modelOption);
  }

  private startVideo = (modelOption: IModelOptions['modelOption']) => {
    if (!navigator.mediaDevices) {
      alert('お使いのブラウザは対応しておりません。');
      return;
    }
    const mediaConstraints = { video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT }, audio: false };
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(async s => {
      this._video.srcObject = s;
      await this._video.play();
      this._net = await bodyPix.load(MODEL_OPTION[modelOption]);
      if (!this._net) {
        alert('bodyPixの読み込みに失敗しました。');
        return;
      }
      this.factoryEffect(this._effectType);
    }, e => {
      alert(e.message);
      return;
    });
  }

  private factoryEffect = (type: string) => {
    this._isAnimate = true;
    if (type === 'off') {
      this.effectCallback(this.offEffect);
    } else if (type === 'color') {
      this.effectCallback(this.colorEffect);
    } else if (type === 'image') {
      this.effectCallback(this.bgImageEffect);
    } else if (type === 'bokeh') {
      this.effectCallback(this.bokehEffect);
    }
  }

  private effectCallback = (callback: () => void) => {
    this._animationId = window.requestAnimationFrame(callback);
  }

  private offEffect = () => {
    this._mainCtx.drawImage(this._video, 0, 0, this._mainCanvas.width, this._mainCanvas.height);
    if (this._isAnimate) {
      this._animationId = window.requestAnimationFrame(this.offEffect);
    }
  }

  private bokehEffect = async () => {
    const { backgroundBlurAmount, edgeBlurAmount, flipHorizontal } = this._drawOption;
    const segmentation = await this._net.segmentPerson(this._video, this._segmentOption);
    bodyPix.drawBokehEffect(this._mainCanvas, this._video, segmentation, backgroundBlurAmount, edgeBlurAmount, flipHorizontal);
    if (this._isAnimate) {
      this._animationId = window.requestAnimationFrame(this.bokehEffect);
    }
  }

  private colorEffect = async () => {
    const segmentation = await this._net.segmentPerson(this._video, this._segmentOption);
    this.drawColorMask(segmentation);
    if (this._isAnimate) {
      this._animationId = window.requestAnimationFrame(this.colorEffect);
    }
  }

  private drawColorMask = (segmentation: bodyPix.SemanticPersonSegmentation) => {
    const { opacity, bgColor, edgeBlurAmount, flipHorizontal } = this._drawOption;
    const fgColor = { r: 0, g: 0, b: 0, a: 0 };
    const maskImage = bodyPix.toMask(segmentation, fgColor, bgColor, true);
    bodyPix.drawMask(this._mainCanvas, this._video, maskImage, opacity, edgeBlurAmount, flipHorizontal);
  }

  private bgImageEffect = async () => {
    const segmentation = await this._net.segmentPerson(this._video, this._segmentOption);
    this.drawReplaceBgImage(segmentation);
    if (this._isAnimate) {
      this._animationId = window.requestAnimationFrame(this.bgImageEffect);
    }
  }

  private drawReplaceBgImage = (segmentation: bodyPix.SemanticPersonSegmentation) => {
    this._mainCtx.drawImage(this._video, 0, 0, this._mainCanvas.width, this._mainCanvas.height);
    const mainImage = this._mainCtx.getImageData(0, 0, this._mainCanvas.width, this._mainCanvas.height);
    const [x, y, w, h] = this.imageCoverSizeAndCenterPostion();
    this._bgCtx.drawImage(this._bgImage, x, y, w, h);
    const bgImage = this._bgCtx.getImageData(0, 0, this._bgCanvas.width, this._bgCanvas.height);
    for (let y = 0; y < VIDEO_HEIGHT; y++) {
      for (let x = 0; x < VIDEO_WIDTH; x++) {
        const base = (y * VIDEO_WIDTH + x) * 4;
        const segbase = y * VIDEO_WIDTH + x;
        if (segmentation.data[segbase] !== 1) {
          mainImage.data[base + 0] = bgImage.data[base + 0];
          mainImage.data[base + 1] = bgImage.data[base + 1];
          mainImage.data[base + 2] = bgImage.data[base + 2];
          mainImage.data[base + 3] = bgImage.data[base + 3];
        }
      }
    }
    this._mainCtx.putImageData(mainImage, 0, 0);
  }

  private imageCoverSizeAndCenterPostion = () => {
    const canvasRate = VIDEO_WIDTH / VIDEO_HEIGHT;
    const rate = this._bgImage.width / this._bgImage.height;
    const w = this._bgCanvas.width;
    const h = this._bgCanvas.height;
    const iw = this._bgImage.width * (h / this._bgImage.height);
    const ih = this._bgImage.height * (w / this._bgImage.width);
    if (rate > canvasRate) {
      return [(w - iw) / 2, 0, iw, h];
    }
    return [0, (h - ih) / 2, w, ih];
  }

  public changeBgImage = (image: HTMLImageElement) => {
    this._bgImage = image;
    this._bgCtx.clearRect(0, 0, this._bgCanvas.width, this._bgCanvas.height);
  }

  public restartEffect = () => {
    this._isAnimate = false;
    window.cancelAnimationFrame(this._animationId);
    // AnimationFrameの停止をしっかり待つ
    setTimeout(() => this.factoryEffect(this._effectType), 300);
  }

  public getStream = () => this._mainCanvas.captureStream();
}
