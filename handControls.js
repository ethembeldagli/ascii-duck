import * as THREE from 'https://unpkg.com/three@0.178.0/build/three.module.js';

let controls;
let camera;

let rightHandPinch = false;
let leftHandPinch = false;
let initialPinchDistance = 0;
let lastRightHandPosition = null;

function rotateCamera(dx, dy) {
    if (!camera || !controls) return;

    const lookAtPoint = controls.target;
    const cameraPosition = camera.position.clone();

    // Create a vector from the target to the camera
    const cameraToObject = cameraPosition.clone().sub(lookAtPoint);

    // Get current spherical coordinates
    const spherical = new THREE.Spherical().setFromVector3(cameraToObject);

    // Apply rotation based on hand movement
    const rotationSpeed = 4;
    spherical.theta -= dx * rotationSpeed; // Horizontal rotation (azimuth)
    spherical.phi -= dy * rotationSpeed; // Vertical rotation (polar)

    // Clamp vertical rotation to avoid flipping over
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    // Convert back to Cartesian coordinates
    const newCameraToObject = new THREE.Vector3().setFromSpherical(spherical);

    // Set the new camera position
    camera.position.copy(lookAtPoint).add(newCameraToObject);

    // Make sure the camera is still looking at the target
    camera.lookAt(lookAtPoint);

    // Let OrbitControls know the camera has been updated
    controls.update();
}

function setThreeJsObjects(threeControls, threeCamera) {
    controls = threeControls;
    camera = threeCamera;
}

function getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
}

function isPinching(landmarks) {
    if (!landmarks) return false;
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    return getDistance(thumbTip, indexTip) < 0.05;
}

function onResults(results) {
    if (!controls) return { rightHandPinch: false, leftHandPinch: false };

    let rightLandmarks, leftLandmarks;
    if (results.multiHandedness && results.multiHandLandmarks) {
        results.multiHandedness.forEach((handInfo, i) => {
            // Swap the hands - what's detected as "Right" is actually "Left" and vice versa
            if (handInfo.label === 'Right') leftLandmarks = results.multiHandLandmarks[i];
            if (handInfo.label === 'Left') rightLandmarks = results.multiHandLandmarks[i];
        });
    }

    const prevRightPinch = rightHandPinch;
    rightHandPinch = isPinching(rightLandmarks);
    leftHandPinch = isPinching(leftLandmarks);

    // Rotation with right hand
    if (rightHandPinch && !leftHandPinch) {
        const curr = rightLandmarks[8];
        if (prevRightPinch && lastRightHandPosition) {
            const dx = lastRightHandPosition.x - curr.x;
            const dy = curr.y - lastRightHandPosition.y;
            rotateCamera(dx, dy);
        }
        lastRightHandPosition = curr;
    } else {
        lastRightHandPosition = null;
    }

    // Zoom with both hands
    if (rightHandPinch && leftHandPinch) {
        const dist = getDistance(rightLandmarks[8], leftLandmarks[8]);
        if (initialPinchDistance) {
            const factor = initialPinchDistance / dist;
            if (factor > 1.03) {
                // Zoom out - move camera further from target
                const lookAtPoint = controls.target;
                const cameraToObject = camera.position.clone().sub(lookAtPoint);
                const newDistance = cameraToObject.length() * 1.05;
                cameraToObject.normalize().multiplyScalar(newDistance);
                camera.position.copy(lookAtPoint).add(cameraToObject);
                camera.lookAt(lookAtPoint);
                controls.update();
            } else if (factor < 0.97) {
                // Zoom in - move camera closer to target
                const lookAtPoint = controls.target;
                const cameraToObject = camera.position.clone().sub(lookAtPoint);
                const newDistance = cameraToObject.length() / 1.05;
                cameraToObject.normalize().multiplyScalar(newDistance);
                camera.position.copy(lookAtPoint).add(cameraToObject);
                camera.lookAt(lookAtPoint);
                controls.update();
            }
        }
        initialPinchDistance = dist;
    } else {
        initialPinchDistance = 0;
    }

    // Return hand states for use in main file
    return { rightHandPinch, leftHandPinch };
}

export { setThreeJsObjects, onResults };