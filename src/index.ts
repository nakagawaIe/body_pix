import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';
import { BodyPixInternalResolution } from '@tensorflow-models/body-pix/dist/types';

tf.getBackend();

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const video = document.getElementById('video') as HTMLVideoElement;

let net: bodyPix.BodyPix;
let bodyPixMaks: ImageData;


const internalResolution: BodyPixInternalResolution = 'medium';
const option = {
  flipHorizontal: false,
  internalResolution,
  segmentationThreshold: 0.7,
  maxDetections: 4,
  scoreThreshold: 0.5,
  nmsRadius: 20,
};


async function startVideo() {
  const mediaConstraints = { video: { width: 640, height: 480 }, audio: false };
  const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  video.srcObject = localStream;
  await video.play();
  net = await bodyPix.load(/** optional arguments, see below **/);
  if (!net) {
    console.warn('bodyPix net NOT READY');
    return;
  }
  // window.requestAnimationFrame(updateCanvas);
  // updateSegment();
  window.requestAnimationFrame(detectBody);
  detectBody();
}
startVideo();

function updateCanvas() {
  drawCanvas();
  window.requestAnimationFrame(updateCanvas);
}

function drawCanvas() {
  const opacity = 1;
  const flipHorizontal = false;
  const maskBlurAmount = 10;
  bodyPix.drawMask(canvas, video, bodyPixMaks, opacity, maskBlurAmount, flipHorizontal);
}

async function updateSegment() {
  net.segmentPerson(video, option).then((segmentation) => {
    const fgColor = { r: 0, g: 0, b: 0, a: 0 };
    const bgColor = { r: 255, g: 255, b: 255, a: 200 };
    const personPartImage = bodyPix.toMask(segmentation, fgColor, bgColor);
    bodyPixMaks = personPartImage;

    drawBody(bodyPixMaks);
  }).catch((err) => {
    console.error('segmentPerson ERROR:', err);
  });
}


const canvasContext = canvas.getContext('2d');

function detectBody() {
  net.segmentPerson(video, option).then(personSegmentation => {
    if (personSegmentation != null) {
      drawBody(personSegmentation);
    }
  });
}

function drawBody(personSegmentation: bodyPix.SemanticPersonSegmentation) {
  // function drawBody(personSegmentation: ImageData) {
  canvasContext.drawImage(video, 0, 0, video.width, video.height);
  const imageData = canvasContext.getImageData(0, 0, video.width, video.height);
  const pixel = imageData.data;
  for (let p = 0; p < pixel.length; p += 4) {
    if (personSegmentation.data[p / 4] == 0) {
      pixel[p + 3] = 0;
    }
  }
  canvasContext.imageSmoothingEnabled = true;
  canvasContext.putImageData(imageData, 0, 0);
  setTimeout(detectBody, 10);
  // setTimeout(updateSegment, 10);
}


function drawToCanvas(canvas, segmentation, img, data_img, data_bg) {
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  const width = img.width;
  const height = img.height;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = (y * width + x) * 4;
      const segbase = y * width + x;
      if (segmentation.data[segbase] == 1) { // is fg
        pixels[base + 0] = data_img.data[base + 0];
        pixels[base + 1] = data_img.data[base + 1];
        pixels[base + 2] = data_img.data[base + 2];
        pixels[base + 3] = data_img.data[base + 3];
      } else {
        pixels[base + 0] = data_bg.data[base + 0];
        pixels[base + 1] = data_bg.data[base + 1];
        pixels[base + 2] = data_bg.data[base + 2];
        pixels[base + 3] = data_bg.data[base + 3];
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
