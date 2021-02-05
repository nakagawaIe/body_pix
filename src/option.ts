import { Color } from '@tensorflow-models/body-pix/dist/types';
import { PersonInferenceConfig, ModelConfig } from '@tensorflow-models/body-pix/dist/body_pix_model';

export const MODEL_OPTION: { [key: string]: ModelConfig; } = {
  lowEnd: {
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 1,
  },
  low: {
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
  },
  default: {
    architecture: 'MobileNetV1',
    outputStride: 8,
    multiplier: 1.0,
    quantBytes: 2,
  },
  middle: {
    architecture: 'MobileNetV1',
    outputStride: 8,
    multiplier: 1.0,
    quantBytes: 4,
  },
  high: {
    architecture: 'ResNet50',
    outputStride: 32,
    multiplier: 1.0,
    quantBytes: 2,
  },
  highEnd: {
    architecture: 'ResNet50',
    outputStride: 16,
    multiplier: 1.0,
    quantBytes: 4,
  },
};

export interface IOptions {
  modelOption?: 'lowEnd' | 'low' | 'default' | 'middle' | 'high' | 'highEnd';
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
  },
  videoConstraints: {
    width: number;
    height: number;
  };
}
