import * as bodyPix from '@tensorflow-models/body-pix';
import { getBackend } from '@tensorflow/tfjs';
import { PersonInferenceConfig } from '@tensorflow-models/body-pix/dist/body_pix_model';
import { MODEL_OPTION, IOptions } from './option';

export class VirtualBgClass {
  private _net: bodyPix.BodyPix;
  private _segmentOption: PersonInferenceConfig;
  private _drawOption: IOptions['drawOption'];
  private _mediaConstraints: MediaStreamConstraints;
  private _animationId: number;
  private _isAnimate = false;
  private _mainCanvas: HTMLCanvasElement;
  private _mainCtx: CanvasRenderingContext2D;
  private _video = document.createElement('video');
  private _bgCanvas = document.createElement('canvas');
  private _bgCtx = this._bgCanvas.getContext('2d');
  public _effectType = 'image';
  public _bgImage: HTMLImageElement;

  /** 描画するcanvas、背景画像、body-pixのオプション類を渡してください */
  constructor(canvas: HTMLCanvasElement, bgImage: HTMLImageElement, option: IOptions) {
    this._segmentOption = option.segmentOption;
    this._drawOption = option.drawOption;
    const { width, height } = option.videoConstraints;
    this._mediaConstraints = {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        aspectRatio: { ideal: width / height },
      },
      audio: false,
    };
    this._mainCanvas = canvas;
    this._mainCtx = this._mainCanvas.getContext('2d');
    this._mainCanvas.width = width;
    this._mainCanvas.height = height;
    this._video.width = width;
    this._video.height = height;
    this._video.playsInline = true;
    this._video.muted = true;
    this._bgCanvas.width = width;
    this._bgCanvas.height = height;
    this._bgImage = bgImage;
    getBackend();
    this.startVideo(option.modelOption);
  }

  private startVideo = (modelOption: IOptions['modelOption']) => {
    if (!navigator.mediaDevices) {
      alert('お使いのブラウザは対応しておりません。');
      return;
    }
    navigator.mediaDevices.getUserMedia(this._mediaConstraints).then(async s => {
      this._video.srcObject = s;
      await this._video.play();
      this._net = await bodyPix.load(MODEL_OPTION[modelOption]);
      if (!this._net) {
        alert('bodyPixの読み込みに失敗しました。');
        return;
      }
      this.factoryEffect(this._effectType);
    }).catch(e => {
      alert(`${e.name}\n${e.message}`);
      return;
    });
  }

  private factoryEffect = (type: string) => {
    this._isAnimate = true;
    if (type === 'off') {
      this.effectRepetition(this.offEffect);
    } else if (type === 'color') {
      this.effectRepetition(this.colorEffect);
    } else if (type === 'image') {
      this.effectRepetition(this.bgImageEffect);
    } else if (type === 'bokeh') {
      this.effectRepetition(this.bokehEffect);
    }
  }

  private effectRepetition = (callback: () => void) => {
    this._animationId = window.requestAnimationFrame(callback);
  }

  private offEffect = () => {
    const [sx, sy, sw, sh, dx, dy, dw, dh] = this.mainCanvasCenterPostion();
    this._mainCtx.drawImage(this._video, sx, sy, sw, sh, dx, dy, dw, dh);
    if (this._isAnimate) this.effectRepetition(this.offEffect);
  }

  private bokehEffect = async () => {
    const { backgroundBlurAmount, edgeBlurAmount, flipHorizontal } = this._drawOption;
    const segmentation = await this._net.segmentPerson(this._video, this._segmentOption);
    console.time('bokeh');
    bodyPix.drawBokehEffect(this._mainCanvas, this._video, segmentation, backgroundBlurAmount, edgeBlurAmount, flipHorizontal);
    console.timeEnd('bokeh');
    if (this._isAnimate) this.effectRepetition(this.bokehEffect);
  }

  private colorEffect = async () => {
    console.time('color');
    const segmentation = await this._net.segmentPerson(this._video, this._segmentOption);
    this.drawColorMask(segmentation);
    console.timeEnd('color');
    if (this._isAnimate) this.effectRepetition(this.colorEffect);
  }

  private drawColorMask = (segmentation: bodyPix.SemanticPersonSegmentation) => {
    const { opacity, bgColor, edgeBlurAmount, flipHorizontal } = this._drawOption;
    const fgColor = { r: 0, g: 0, b: 0, a: 0 };
    const maskImage = bodyPix.toMask(segmentation, fgColor, bgColor, true);
    bodyPix.drawMask(this._mainCanvas, this._video, maskImage, opacity, edgeBlurAmount, flipHorizontal);
  }

  private bgImageEffect = async () => {
    console.time('all');
    console.time('segment');
    const segmentation = await this._net.segmentPerson(this._video, this._segmentOption);
    console.timeEnd('segment');
    console.time('draw');
    this.drawReplaceBgImage(segmentation);
    console.timeEnd('draw');
    console.timeEnd('all');
    if (this._isAnimate) this.effectRepetition(this.bgImageEffect);
  }

  private drawReplaceBgImage = (segmentation: bodyPix.SemanticPersonSegmentation) => {
    const [sx, sy, sw, sh, dx, dy, dw, dh] = this.mainCanvasCenterPostion();
    this._mainCtx.drawImage(this._video, sx, sy, sw, sh, dx, dy, dw, dh);
    const { width, height } = this._mainCanvas;
    const mainImage = this._mainCtx.getImageData(0, 0, width, height);
    const [x, y, w, h] = this.imageCoverSizeAndCenterPostion();
    this._bgCtx.drawImage(this._bgImage, x, y, w, h);
    const bgImage = this._bgCtx.getImageData(0, 0, this._bgCanvas.width, this._bgCanvas.height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const base = (y * width + x) * 4;
        const segbase = y * width + x;
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
    const { width, height } = this._mainCanvas;
    const { width: bgWidth, height: bgHeight } = this._bgImage;
    const { width: w, height: h } = this._bgCanvas;
    const canvasRate = width / height;
    const rate = bgWidth / bgHeight;
    const iw = bgWidth * (h / bgHeight);
    const ih = bgHeight * (w / bgWidth);
    if (rate > canvasRate) {
      return [(w - iw) / 2, 0, iw, h];
    }
    return [0, (h - ih) / 2, w, ih];
  }

  private mainCanvasCenterPostion = () => {
    const { width, height } = this._mainCanvas;
    const { videoWidth, videoHeight } = this._video;
    return [
      0, 0,
      videoWidth,
      videoHeight,
      (width - videoWidth) / 2,
      (height - videoHeight) / 2,
      videoWidth,
      videoHeight,
    ];
  }

  public changeBgImage = (image: HTMLImageElement) => {
    this._bgImage = image;
    this._bgCtx.clearRect(0, 0, this._bgCanvas.width, this._bgCanvas.height);
  }

  public restartEffect = () => {
    this._isAnimate = false;
    window.cancelAnimationFrame(this._animationId);
    this._mainCtx.clearRect(0, 0, this._mainCanvas.width, this._mainCanvas.height);
    // AnimationFrameの停止をしっかり待つ
    setTimeout(() => this.factoryEffect(this._effectType), 300);
  }

  public getStream = () => this._mainCanvas.captureStream();
}
