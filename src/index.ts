import { VirtualBgClass } from './virtual_bg';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const bgImage = document.querySelector('.images img') as HTMLImageElement;
const bgEffect = new VirtualBgClass(canvas, bgImage);

document.querySelector(`[data-type="${bgEffect.effectType}"]`).classList.add('is-active');

const buttons = document.querySelectorAll('.buttons li');
for (let i = 0; i < buttons.length; i++) {
  const button = buttons[i] as HTMLElement;
  button.onclick = () => {
    buttons.forEach(b => b.classList.remove('is-active'));
    button.classList.add('is-active');
    bgEffect.effectType = button.dataset.type;
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
    bgEffect.bgImage = image;
    bgEffect.restartEffect();
  };
}
