import './style.scss';
import { VirtualBgClass } from './virtual_bg';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const imagesWrap = document.querySelector('.images') as HTMLUListElement;
const bgImage = document.querySelector('.images img') as HTMLImageElement;
const bgEffect = new VirtualBgClass(canvas, bgImage);

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
