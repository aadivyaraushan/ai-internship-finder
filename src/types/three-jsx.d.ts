import 'react';
import * as THREE from 'three';
import { Object3DNode } from '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      line: Object3DNode<THREE.Line, typeof THREE.Line>;
    }
  }
}
