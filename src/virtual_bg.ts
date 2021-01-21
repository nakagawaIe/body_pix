import * as bodyPix from '@tensorflow-models/body-pix';
import { getBackend } from '@tensorflow/tfjs';
import { BodyPixInternalResolution } from '@tensorflow-models/body-pix/dist/types';
import { PersonInferenceConfig } from '@tensorflow-models/body-pix/dist/body_pix_model';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

/** 反転 */
const flipHorizontal = false;
/** 大きいほど正確になるが、予測時間が遅くなる */
const internalResolution: BodyPixInternalResolution = 'medium';
/** (0 ~ 20) 人物と背景間のエッジをぼかすピクセル数 */
const edgeBlurAmount = 5;
/** (0 ~ 1) 値が高いほど人の周りのトリミングがタイトになる */
const segmentationThreshold = 0.7;
/** 画像ごとに検出する人物ポーズの最大数 */
const maxDetections = 4;
/** ルートパーツスコアがこの値以上の個人検出のみを返します (?) */
const scoreThreshold = 0.5;
/** 非最大抑制部分の距離 (?) */
const nmsRadius = 20;

const SEGMENT_OPTION: PersonInferenceConfig = {
  flipHorizontal,
  internalResolution,
  segmentationThreshold,
  maxDetections,
  scoreThreshold,
  nmsRadius,
};

export class VirtualBgClass {
  private _net: bodyPix.BodyPix;
  private _animationId: number;
  private _isAnimate = false;
  private _mainCanvas: HTMLCanvasElement;
  private _mainCtx: CanvasRenderingContext2D;
  private _video = document.createElement('video');
  private _bgCanvas = document.createElement('canvas');
  private _bgCtx = this._bgCanvas.getContext('2d');
  public _effectType = 'image';
  public _bgImage: HTMLImageElement;

  constructor(canvas: HTMLCanvasElement, bgImage: HTMLImageElement) {
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
    this.startVideo();
  }

  private startVideo = async () => {
    const mediaConstraints = { video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT }, audio: false };
    const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    this._video.srcObject = localStream;
    await this._video.play();
    this._net = await bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.5,
      quantBytes: 2,
    });
    if (!this._net) {
      console.warn('bodyPix net NOT READY');
      return;
    }
    this.factoryEffect(this._effectType);
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
    callback();
  }

  private offEffect = () => {
    this._mainCtx.drawImage(this._video, 0, 0, this._mainCanvas.width, this._mainCanvas.height);
    if (this._isAnimate) {
      this._animationId = window.requestAnimationFrame(this.offEffect);
    }
  }

  private bokehEffect = async () => {
    /** (1 ~ 20) ぼかし具合 */
    const backgroundBlurAmount = 15;
    const segmentation = await this._net.segmentPerson(this._video, SEGMENT_OPTION);
    bodyPix.drawBokehEffect(this._mainCanvas, this._video, segmentation, backgroundBlurAmount, edgeBlurAmount, flipHorizontal);
    if (this._isAnimate) {
      this._animationId = window.requestAnimationFrame(this.bokehEffect);
    }
  }

  private colorEffect = async () => {
    const segmentation = await this._net.segmentPerson(this._video, SEGMENT_OPTION);
    this.drawColorMask(segmentation);
    if (this._isAnimate) {
      this._animationId = window.requestAnimationFrame(this.colorEffect);
    }
  }

  private drawColorMask = (segmentation: bodyPix.SemanticPersonSegmentation) => {
    const opacity = 1;
    const fgColor = { r: 0, g: 0, b: 0, a: 0 };
    const bgColor = { r: 0, g: 0, b: 0, a: 220 };
    const maskImage = bodyPix.toMask(segmentation, fgColor, bgColor, true);
    bodyPix.drawMask(this._mainCanvas, this._video, maskImage, opacity, edgeBlurAmount, flipHorizontal);
  }

  private bgImageEffect = async () => {
    const segmentation = await this._net.segmentPerson(this._video, SEGMENT_OPTION);
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
    const width = this._bgCanvas.width;
    const height = this._bgCanvas.height;
    const iw = this._bgImage.width * (height / this._bgImage.height);
    const ih = this._bgImage.height * (width / this._bgImage.width);
    if (rate > canvasRate) {
      return [(width - iw) / 2, 0, iw, height];
    }
    return [0, (height - ih) / 2, width, ih];
  }

  public changeBgImage = (image: HTMLImageElement) => {
    this._bgImage = image;
    this._bgCtx.clearRect(0, 0, this._bgCanvas.width, this._bgCanvas.height);
  }

  public restartEffect = () => {
    this._isAnimate = false;
    window.cancelAnimationFrame(this._animationId);
    // AnimationFrameの停止をしっかり待つ
    setTimeout(() => this.factoryEffect(this._effectType), 120);
  }

  public getStream = () => this._mainCanvas.captureStream();
}
