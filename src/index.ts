import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';
import { BodyPixInternalResolution } from '@tensorflow-models/body-pix/dist/types';

let net: bodyPix.BodyPix;
let effectTimeId: NodeJS.Timeout;
let selectedType = 'image';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

const internalResolution: BodyPixInternalResolution = 'medium';
const flipHorizontal = true;
const edgeBlurAmount = 5;
const SEGMENT_OPTION = {
  flipHorizontal,
  internalResolution,
  segmentationThreshold: 0.7,
  maxDetections: 4,
  scoreThreshold: 0.5,
  nmsRadius: 20,
};

const mainCanvas = document.getElementById('canvas') as HTMLCanvasElement;
const mainCtx = mainCanvas.getContext('2d');
mainCanvas.width = VIDEO_WIDTH;
mainCanvas.height = VIDEO_HEIGHT;

const video = document.createElement('video');
video.width = VIDEO_WIDTH;
video.height = VIDEO_HEIGHT;

let bgImage = document.querySelector('.images img') as HTMLImageElement;

const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');
bgCanvas.width = VIDEO_WIDTH;
bgCanvas.height = VIDEO_HEIGHT;

const constructor = () => {
  tf.getBackend();
  startVideo();
};

const startVideo = async () => {
  const mediaConstraints = { video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT }, audio: false };
  const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  video.srcObject = localStream;
  await video.play();
  net = await bodyPix.load();
  if (!net) {
    console.warn('bodyPix net NOT READY');
    return;
  }
  factoryEffect(selectedType);
};

const factoryEffect = (type?: string) => {
  if (type === 'off') {
    effectCallback(offEffect);
  } else if (type === 'color') {
    effectCallback(colorEffect);
  } else if (type === 'image') {
    effectCallback(bgImageEffect);
  } else {
    effectCallback(bokehEffect);
  }
};

const effectCallback = (callback: () => void) => {
  window.requestAnimationFrame(callback);
  callback();
  effectTimeId = setInterval(callback, 10);
};

const offEffect = () => {
  mainCtx.drawImage(video, 0, 0, mainCanvas.width, mainCanvas.height);
};

const bokehEffect = () => {
  const backgroundBlurAmount = 10;
  net.segmentPerson(video, SEGMENT_OPTION).then(s => {
    bodyPix.drawBokehEffect(mainCanvas, video, s, backgroundBlurAmount, edgeBlurAmount, flipHorizontal);
  });
};

const colorEffect = () => {
  const opacity = 1;
  net.segmentPerson(video, SEGMENT_OPTION).then((segmentation) => {
    const fgColor = { r: 0, g: 0, b: 0, a: 0 };
    const bgColor = { r: 0, g: 0, b: 0, a: 220 };
    const personPartImage = bodyPix.toMask(segmentation, fgColor, bgColor);
    bodyPix.drawMask(mainCanvas, video, personPartImage, opacity, edgeBlurAmount, flipHorizontal);
  }).catch((err) => {
    console.error('segmentPerson ERROR:', err);
  });
};

const bgImageEffect = () => {
  net.segmentPerson(video, SEGMENT_OPTION).then(s => drawToCanvas(s));
};

const drawToCanvas = (segmentation: bodyPix.SemanticPersonSegmentation) => {
  mainCtx.drawImage(video, 0, 0, video.width, video.height);
  const imageData = mainCtx.getImageData(0, 0, video.width, video.height);
  bgCtx.drawImage(bgImage, 0, 0, mainCanvas.width, mainCanvas.height);
  const bgCtxImage = bgCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  for (let y = 0; y < VIDEO_HEIGHT; y++) {
    for (let x = 0; x < VIDEO_WIDTH; x++) {
      const base = (y * VIDEO_WIDTH + x) * 4;
      const segbase = y * VIDEO_WIDTH + x;
      if (segmentation.data[segbase] !== 1) { // is bg
        imageData.data[base + 0] = bgCtxImage.data[base + 0];
        imageData.data[base + 1] = bgCtxImage.data[base + 1];
        imageData.data[base + 2] = bgCtxImage.data[base + 2];
        imageData.data[base + 3] = bgCtxImage.data[base + 3];
      }
    }
  }
  mainCtx.putImageData(imageData, 0, 0);
};


constructor();

bgImage.classList.add('is-active');
document.querySelector(`[data-type="${selectedType}"]`).classList.add('is-active');

const buttons = document.querySelectorAll('.buttons li');
for (let i = 0; i < buttons.length; i++) {
  const button = buttons[i] as HTMLElement;
  button.onclick = () => {
    buttons.forEach(b => b.classList.remove('is-active'));
    button.classList.add('is-active');
    selectedType = button.dataset.type;
    restartEffect();
  };
}

const images = document.querySelectorAll('.images img');
for (let i = 0; i < images.length; i++) {
  const image = images[i] as HTMLImageElement;
  image.onclick = () => {
    images.forEach(b => b.classList.remove('is-active'));
    image.classList.add('is-active');
    bgImage = image;
    restartEffect();
  };
}

const restartEffect = () => {
  clearTimeout(effectTimeId);
  factoryEffect(selectedType);
};
