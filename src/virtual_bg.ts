import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';
import { BodyPixInternalResolution } from '@tensorflow-models/body-pix/dist/types';
import { PersonInferenceConfig } from '@tensorflow-models/body-pix/dist/body_pix_model';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

/** 反転 */
const flipHorizontal = true;
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
  private net: bodyPix.BodyPix;
  private animationId: number;
  private isAnimate = false;
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private video = document.createElement('video');
  private bgCanvas = document.createElement('canvas');
  private bgCtx = this.bgCanvas.getContext('2d');
  public effectType = 'bokeh';
  public bgImage: HTMLImageElement;

  constructor(canvas: HTMLCanvasElement, bgImage: HTMLImageElement) {
    tf.getBackend();
    this.startVideo();

    this.mainCanvas = canvas;
    this.mainCtx = this.mainCanvas.getContext('2d');
    this.mainCanvas.width = VIDEO_WIDTH;
    this.mainCanvas.height = VIDEO_HEIGHT;
    this.video.width = VIDEO_WIDTH;
    this.video.height = VIDEO_HEIGHT;
    this.bgCanvas.width = VIDEO_WIDTH;
    this.bgCanvas.height = VIDEO_HEIGHT;
    this.bgImage = bgImage;
  }

  private startVideo = async () => {
    const mediaConstraints = { video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT }, audio: false };
    const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    this.video.srcObject = localStream;
    await this.video.play();
    this.net = await bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.5,
      quantBytes: 2,
    });
    if (!this.net) {
      console.warn('bodyPix net NOT READY');
      return;
    }
    this.factoryEffect(this.effectType);
  }

  private factoryEffect = (type: string) => {
    this.isAnimate = true;
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
    this.animationId = window.requestAnimationFrame(callback);
    callback();
  }

  private offEffect = () => {
    this.mainCtx.drawImage(this.video, 0, 0, this.mainCanvas.width, this.mainCanvas.height);
    if (this.isAnimate) {
      this.animationId = window.requestAnimationFrame(this.offEffect);
    }
  }

  private bokehEffect = async () => {
    /** (1 ~ 20) ぼかし具合 */
    const backgroundBlurAmount = 15;
    const segmentation = await this.net.segmentPerson(this.video, SEGMENT_OPTION);
    bodyPix.drawBokehEffect(this.mainCanvas, this.video, segmentation, backgroundBlurAmount, edgeBlurAmount, flipHorizontal);
    if (this.isAnimate) {
      this.animationId = window.requestAnimationFrame(this.bokehEffect);
    }
  }

  private colorEffect = async () => {
    const segmentation = await this.net.segmentPerson(this.video, SEGMENT_OPTION);
    this.drawColorMask(segmentation);
    if (this.isAnimate) {
      this.animationId = window.requestAnimationFrame(this.colorEffect);
    }
  }

  private drawColorMask = (segmentation: bodyPix.SemanticPersonSegmentation) => {
    const opacity = 1;
    const fgColor = { r: 0, g: 0, b: 0, a: 0 };
    const bgColor = { r: 0, g: 0, b: 0, a: 220 };
    const maskImage = bodyPix.toMask(segmentation, fgColor, bgColor, true);
    bodyPix.drawMask(this.mainCanvas, this.video, maskImage, opacity, edgeBlurAmount, flipHorizontal);
  }

  private bgImageEffect = async () => {
    const segmentation = await this.net.segmentPerson(this.video, SEGMENT_OPTION);
    this.drawReplaceBgImage(segmentation);
    if (this.isAnimate) {
      this.animationId = window.requestAnimationFrame(this.bgImageEffect);
    }
  }

  private drawReplaceBgImage = (segmentation: bodyPix.SemanticPersonSegmentation) => {
    this.mainCtx.drawImage(this.video, 0, 0, this.video.width, this.video.height);
    const mainImage = this.mainCtx.getImageData(0, 0, this.video.width, this.video.height);
    this.bgCtx.drawImage(this.bgImage, 0, 0, this.mainCanvas.width, this.mainCanvas.height);
    const bgCtxImage = this.bgCtx.getImageData(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    for (let y = 0; y < VIDEO_HEIGHT; y++) {
      for (let x = 0; x < VIDEO_WIDTH; x++) {
        const base = (y * VIDEO_WIDTH + x) * 4;
        const segbase = y * VIDEO_WIDTH + x;
        if (segmentation.data[segbase] !== 1) {
          mainImage.data[base + 0] = bgCtxImage.data[base + 0];
          mainImage.data[base + 1] = bgCtxImage.data[base + 1];
          mainImage.data[base + 2] = bgCtxImage.data[base + 2];
          mainImage.data[base + 3] = bgCtxImage.data[base + 3];
        }
      }
    }
    this.mainCtx.putImageData(mainImage, 0, 0);
  }

  public restartEffect = () => {
    this.isAnimate = false;
    window.cancelAnimationFrame(this.animationId);
    // AnimationFrameの停止をしっかり待つ
    setTimeout(() => this.factoryEffect(this.effectType), 100);
  }
}
