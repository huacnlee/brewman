import { Shader, reduceMotion, token } from "nsh";
import { SCENE } from "./scene";

/** The night backdrop, behind everything; still while the system asks for reduced motion. */
export function NightScene() {
  return <Shader source={SCENE} paused={reduceMotion()} accessibilityElementsHidden
    uniforms={{sky: token("night"), glow: token("beam"), gold: token("primary"), base: token("background")}}
    class="absolute inset-0"/>;
}
