import * as Cesium from 'cesium';

/**
 * 臺灣海陸空 2D 平面戰術大盤定位
 * 正北朝上（North-Up）、正垂向下俯瞰（Pitch -90°）、高空 850km 全覽臺灣全島與周邊海峽船舶
 */
export function flyToTaiwan2D(viewer) {
  // Start from high altitude
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(120.98, 23.85, 1500000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
  });

  // Cinematic smooth zoom to 850km 2D overview
  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(120.98, 23.85, 850000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 300);

  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}

/**
 * 高雄港與海軍戰術視角（斜角 3D 俯瞰）
 */
export function flyToKaohsiung(viewer) {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(120.265, 22.585, 35000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
  });

  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(120.265, 22.585, 4500),
      orientation: {
        heading: Cesium.Math.toRadians(325),
        pitch: Cesium.Math.toRadians(-32),
        roll: 0.0,
      },
      duration: 3.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 400);

  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}

/** Backward compatibility alias for legacy callers and unit tests */
export const flyToAustin = flyToTaiwan2D;


