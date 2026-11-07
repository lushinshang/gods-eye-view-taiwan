import * as Cesium from 'cesium';

/**
 * Set camera to Kaohsiung Harbor on load with a cinematic tactical fly-in.
 * 臺灣海域戰情台：開機直接鎖定高雄港與海軍基地核心戰區，俯瞰外海商船群與港區航道。
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToKaohsiung(viewer) {
  // Start from high tactical altitude above southern Taiwan Strait
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(120.265, 22.585, 35000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
  });

  // Cinematic tactical fly-in to Kaohsiung Harbor & naval operational zone
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
export const flyToAustin = flyToKaohsiung;

