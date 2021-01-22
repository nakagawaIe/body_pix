import './style.scss';
import { VirtualBgClass, IModelOptions } from './virtual_bg';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const imagesWrap = document.querySelector('.images') as HTMLUListElement;
  const bgImage = document.querySelector('.images img') as HTMLImageElement;
  const option: IModelOptions = {
    // modelOption: 'middle',
    // segmentOption: {
    //   internalResolution: 'medium', // 大きいほど正確になるが、予測時間が遅くなる
    //   segmentationThreshold: 0.7, // (0 ~ 1) 値が高いほど人の周りのトリミングがタイトになる
    // },
    drawOption: {
      opacity: 0.8,
      bgColor: { r: 0, g: 0, b: 0, a: 255 },
      flipHorizontal: false,
      edgeBlurAmount: 5,
      backgroundBlurAmount: 15,
    },
  };
  const bgEffect = new VirtualBgClass(canvas, bgImage, option);

  const buttons = document.querySelectorAll('.buttons li');
  document.querySelector(`[data-type="${bgEffect._effectType}"]`).classList.add('is-active');

  const imageActive = () => imagesWrap.style.display = bgEffect._effectType === 'image' ? 'flex' : 'none';
  imageActive();

  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i] as HTMLElement;
    button.onclick = () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      button.classList.add('is-active');
      bgEffect._effectType = button.dataset.type;
      imageActive();
      bgEffect.restartEffect();
    };
  }

  const images = document.querySelectorAll('.images img');
  bgImage.classList.add('is-active');
  for (let i = 0; i < images.length; i++) {
    const image = images[i] as HTMLImageElement;
    image.onclick = () => {
      images.forEach(b => b.classList.remove('is-active'));
      image.classList.add('is-active');
      bgEffect.changeBgImage(image);
    };
  }

  const capture = document.getElementById('capture') as HTMLVideoElement;
  // 適当に5秒待つ
  setTimeout(() => {
    capture.srcObject = bgEffect.getStream();
    capture.play();
  }, 5000);
});
