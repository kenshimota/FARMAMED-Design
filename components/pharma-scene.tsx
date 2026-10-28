"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function makeBottleLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas context");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 1024, 512);
  context.fillStyle = "#0b64b8";
  context.fillRect(0, 0, 1024, 34);
  context.fillStyle = "#a5d737";
  context.fillRect(0, 34, 1024, 9);
  context.fillStyle = "#edf5fb";
  context.fillRect(0, 402, 1024, 110);

  context.fillStyle = "#a5d737";
  context.fillRect(208, 111, 30, 96);
  context.fillRect(175, 144, 96, 30);
  context.fillStyle = "#0b64b8";
  context.font = "700 65px Arial";
  context.textAlign = "left";
  context.fillText("FARMAMED", 298, 177);
  context.fillStyle = "#647080";
  context.font = "500 24px Arial";
  context.fillText("CUIDADO Y BIENESTAR", 301, 218);

  context.fillStyle = "#1b0c68";
  context.font = "600 30px Arial";
  context.fillText("Solución oral", 301, 308);
  context.fillStyle = "#647080";
  context.font = "22px Arial";
  context.fillText("Uso farmacéutico · 50 ml", 301, 347);
  context.fillStyle = "#0b64b8";
  context.font = "700 22px monospace";
  context.fillText("FM  /  0248", 70, 465);
  context.fillStyle = "#7b9c34";
  context.fillRect(780, 442, 160, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCartonLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas context");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 512, 768);
  context.fillStyle = "#0b64b8";
  context.fillRect(0, 0, 62, 768);
  context.fillStyle = "#a5d737";
  context.fillRect(62, 0, 450, 22);
  context.fillRect(62, 598, 450, 170);
  context.fillStyle = "#edf5fb";
  context.fillRect(98, 82, 350, 150);

  context.fillStyle = "#7b9c34";
  context.fillRect(125, 114, 18, 58);
  context.fillRect(105, 134, 58, 18);
  context.fillStyle = "#0b64b8";
  context.font = "700 35px Arial";
  context.textAlign = "left";
  context.fillText("FARMAMED", 179, 155);
  context.fillStyle = "#647080";
  context.font = "16px Arial";
  context.fillText("CUIDADO Y BIENESTAR", 180, 184);

  context.fillStyle = "#1b0c68";
  context.font = "700 42px Arial";
  context.fillText("Cápsulas", 105, 326);
  context.fillStyle = "#647080";
  context.font = "23px Arial";
  context.fillText("Bienestar diario", 105, 368);
  context.fillStyle = "#0b64b8";
  context.fillRect(105, 412, 245, 5);
  context.font = "600 22px Arial";
  context.fillText("20 unidades", 105, 474);
  context.fillStyle = "#647080";
  context.font = "18px monospace";
  context.fillText("FM–0248", 105, 527);
  context.fillStyle = "#1b0c68";
  context.font = "700 25px Arial";
  context.fillText("FM", 105, 677);
  context.fillStyle = "#1b0c68";
  for (let index = 0; index < 28; index += 1) {
    context.fillRect(210 + index * 6, 650, index % 3 === 0 ? 3 : 1, 55);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCapsule(primary: number, secondary: number) {
  const group = new THREE.Group();
  const radius = 0.24;
  const halfBody = 0.52;
  const primaryMaterial = new THREE.MeshPhysicalMaterial({
    color: primary,
    roughness: 0.24,
    clearcoat: 0.75,
    clearcoatRoughness: 0.2,
  });
  const secondaryMaterial = new THREE.MeshPhysicalMaterial({
    color: secondary,
    roughness: 0.28,
    clearcoat: 0.6,
  });

  const lowerBody = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, halfBody, 32), primaryMaterial);
  lowerBody.position.y = -halfBody / 2;
  const lowerCap = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    primaryMaterial,
  );
  lowerCap.position.y = -halfBody;

  const upperBody = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, halfBody, 32), secondaryMaterial);
  upperBody.position.y = halfBody / 2;
  const upperCap = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    secondaryMaterial,
  );
  upperCap.position.y = halfBody;

  group.add(lowerBody, lowerCap, upperBody, upperCap);
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}

function createCross(color: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.5 });
  const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.18), material);
  const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.18), material);
  vertical.castShadow = true;
  horizontal.castShadow = true;
  group.add(vertical, horizontal);
  return group;
}

export default function PharmaScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      window.requestAnimationFrame(() => setStatus("error"));
      return;
    }

    try {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.dataset.engine = "three.js";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "pan-y";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      const root = new THREE.Group();
      root.position.y = 0.05;
      scene.add(root);

      const hemisphere = new THREE.HemisphereLight(0xf4f9ff, 0x7b9c34, 2.2);
      scene.add(hemisphere);
      const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
      keyLight.position.set(-3.5, 6, 5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -5;
      keyLight.shadow.camera.right = 5;
      keyLight.shadow.camera.top = 5;
      keyLight.shadow.camera.bottom = -5;
      keyLight.shadow.bias = -0.0004;
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x8dd9ff, 2.1);
      fillLight.position.set(5, 1, 2);
      scene.add(fillLight);
      const rimLight = new THREE.PointLight(0xa5d737, 12, 12);
      rimLight.position.set(-3, 1, -3);
      scene.add(rimLight);

      const bottle = new THREE.Group();
      const bottleMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xf6fbff,
        roughness: 0.25,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
      });
      const capMaterial = new THREE.MeshPhysicalMaterial({ color: 0xa5d737, roughness: 0.34, clearcoat: 0.35 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.9, 2.12, 64), bottleMaterial);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.86, 48, 24), bottleMaterial);
      shoulder.scale.y = 0.34;
      shoulder.position.y = 1.02;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.67, 0.72, 0.4, 48), bottleMaterial);
      neck.position.y = 1.25;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.46, 64), capMaterial);
      cap.position.y = 1.54;
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.71, 0.76, 0.06, 64), capMaterial);
      capTop.position.y = 1.8;

      const labelTexture = makeBottleLabel();
      labelTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.909, 0.909, 1.18, 64, 1, true),
        new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.5 }),
      );
      label.position.y = -0.12;
      label.rotation.y = -2.5;

      const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.33, 0.055), capMaterial, 36);
      const ridgeTransform = new THREE.Object3D();
      for (let index = 0; index < 36; index += 1) {
        const angle = (index / 36) * Math.PI * 2;
        ridgeTransform.position.set(Math.sin(angle) * 0.765, 1.54, Math.cos(angle) * 0.765);
        ridgeTransform.rotation.set(0, angle, 0);
        ridgeTransform.updateMatrix();
        ridges.setMatrixAt(index, ridgeTransform.matrix);
      }
      ridges.instanceMatrix.needsUpdate = true;

      bottle.add(body, shoulder, neck, cap, capTop, label, ridges);
      bottle.position.set(0.38, 0.04, 0.42);
      bottle.rotation.set(0.02, -0.18, -0.08);
      bottle.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      root.add(bottle);

      const cartonTexture = makeCartonLabel();
      cartonTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      const carton = new THREE.Group();
      const cartonBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 2.35, 0.76),
        new THREE.MeshPhysicalMaterial({ color: 0xf8fbff, roughness: 0.42, clearcoat: 0.18 }),
      );
      const cartonFront = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 2.29),
        new THREE.MeshStandardMaterial({ map: cartonTexture, roughness: 0.55 }),
      );
      cartonFront.position.z = 0.386;
      const cartonSide = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 2.28),
        new THREE.MeshStandardMaterial({ color: 0x0b64b8, roughness: 0.5 }),
      );
      cartonSide.position.x = 0.781;
      cartonSide.rotation.y = Math.PI / 2;
      carton.add(cartonBody, cartonFront, cartonSide);
      carton.position.set(-1.15, -0.16, -0.62);
      carton.rotation.set(-0.03, 0.26, 0.09);
      carton.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      root.add(carton);

      const smallCarton = new THREE.Group();
      const smallBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 1.2, 0.62),
        new THREE.MeshStandardMaterial({ color: 0xf8fbff, roughness: 0.48 }),
      );
      const smallFront = new THREE.Mesh(
        new THREE.PlaneGeometry(1.02, 1.16),
        new THREE.MeshStandardMaterial({ map: cartonTexture, roughness: 0.55 }),
      );
      smallFront.position.z = 0.316;
      smallCarton.add(smallBody, smallFront);
      smallCarton.position.set(1.63, -0.79, -0.56);
      smallCarton.rotation.set(0.02, -0.38, -0.06);
      smallCarton.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      root.add(smallCarton);

      const foregroundCapsule = createCapsule(0x0b64b8, 0xa5d737);
      foregroundCapsule.position.set(1.25, -1.18, 1.35);
      foregroundCapsule.rotation.set(0.48, 0.25, -1.02);
      foregroundCapsule.scale.setScalar(1.15);
      root.add(foregroundCapsule);

      const floatingCapsule = createCapsule(0xa5d737, 0xf6fbff);
      floatingCapsule.position.set(-1.67, 1.33, 0.25);
      floatingCapsule.rotation.set(0.2, 0.45, 0.78);
      floatingCapsule.scale.setScalar(0.72);
      root.add(floatingCapsule);

      const smallCapsule = createCapsule(0x009fe3, 0xf6fbff);
      smallCapsule.position.set(1.85, 0.65, -0.1);
      smallCapsule.rotation.set(-0.3, 0.25, -0.62);
      smallCapsule.scale.setScalar(0.58);
      root.add(smallCapsule);

      const cross = createCross(0xa5d737);
      cross.position.set(1.63, 1.67, -0.9);
      cross.rotation.set(-0.1, -0.25, 0.12);
      cross.scale.setScalar(0.72);
      root.add(cross);
      const smallCross = createCross(0x009fe3);
      smallCross.position.set(-2.02, 0.38, 0.5);
      smallCross.rotation.set(0.15, 0.2, -0.15);
      smallCross.scale.setScalar(0.36);
      root.add(smallCross);

      const orbit = new THREE.Group();
      const orbitRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.55, 0.009, 6, 160),
        new THREE.MeshBasicMaterial({ color: 0x0b64b8, transparent: true, opacity: 0.3 }),
      );
      const orbitDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xa5d737 }),
      );
      orbitDot.position.x = 2.55;
      orbit.add(orbitRing, orbitDot);
      orbit.rotation.set(1.18, 0.2, -0.18);
      root.add(orbit);

      const secondOrbit = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.007, 6, 140),
        new THREE.MeshBasicMaterial({ color: 0x7b9c34, transparent: true, opacity: 0.23 }),
      );
      secondOrbit.rotation.set(1.48, -0.35, 0.35);
      root.add(secondOrbit);

      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(2.05, 2.17, 0.09, 96),
        new THREE.MeshPhysicalMaterial({ color: 0xeaf3f7, roughness: 0.5, transparent: true, opacity: 0.7 }),
      );
      platform.position.y = -1.55;
      platform.receiveShadow = true;
      root.add(platform);
      const platformRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.12, 0.018, 8, 120),
        new THREE.MeshBasicMaterial({ color: 0x009fe3, transparent: true, opacity: 0.24 }),
      );
      platformRing.position.y = -1.5;
      platformRing.rotation.x = Math.PI / 2;
      root.add(platformRing);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.12 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.61;
      floor.receiveShadow = true;
      scene.add(floor);

      let seed = 18;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const positions = new Float32Array(72 * 3);
      for (let index = 0; index < 72; index += 1) {
        const angle = random() * Math.PI * 2;
        const radius = 2.3 + random() * 1.3;
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = (random() - 0.5) * 4.6;
        positions[index * 3 + 2] = Math.sin(angle) * radius - 0.8;
      }
      const particlesGeometry = new THREE.BufferGeometry();
      particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particles = new THREE.Points(
        particlesGeometry,
        new THREE.PointsMaterial({ color: 0x0b64b8, size: 0.026, transparent: true, opacity: 0.42 }),
      );
      root.add(particles);

      const pointerTarget = new THREE.Vector2();
      const pointerCurrent = new THREE.Vector2();
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      let reducedMotion = motionQuery.matches;
      let visible = true;
      let running = false;
      let animationId = 0;

      const render = (time = 0) => {
        if (!reducedMotion) {
          const seconds = time * 0.001;
          pointerCurrent.lerp(pointerTarget, 0.045);
          root.rotation.y = -0.08 + Math.sin(seconds * 0.32) * 0.16 + pointerCurrent.x * 0.11;
          root.rotation.x = Math.sin(seconds * 0.25) * 0.025 - pointerCurrent.y * 0.055;
          root.position.x = pointerCurrent.x * 0.1;
          bottle.position.y = 0.04 + Math.sin(seconds * 1.05) * 0.055;
          floatingCapsule.position.y = 1.33 + Math.sin(seconds * 1.3 + 1) * 0.13;
          floatingCapsule.rotation.y = 0.45 + seconds * 0.28;
          smallCapsule.position.y = 0.65 + Math.sin(seconds * 1.15 + 2) * 0.1;
          smallCapsule.rotation.y = 0.25 - seconds * 0.2;
          foregroundCapsule.position.y = -1.18 + Math.sin(seconds * 0.9) * 0.035;
          cross.rotation.y = -0.25 + Math.sin(seconds * 0.55) * 0.25;
          orbit.rotation.z = -0.18 + seconds * 0.075;
          secondOrbit.rotation.z = 0.35 - seconds * 0.05;
          particles.rotation.y = seconds * 0.018;
        }
        renderer.render(scene, camera);
      };

      const animate = (time: number) => {
        if (!running) return;
        render(time);
        animationId = window.requestAnimationFrame(animate);
      };

      const updatePlayback = () => {
        const shouldRun = visible && !document.hidden && !reducedMotion;
        if (shouldRun && !running) {
          running = true;
          animationId = window.requestAnimationFrame(animate);
        } else if (!shouldRun && running) {
          running = false;
          window.cancelAnimationFrame(animationId);
        }
      };

      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height) return;
        const aspect = width / height;
        renderer.setSize(width, height, false);
        camera.aspect = aspect;
        const distance = aspect < 0.85 ? 11.4 : aspect < 1.1 ? 10.1 : 9.2;
        camera.position.set(4.5, 2.7, 7.8).normalize().multiplyScalar(distance);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        render();
      };

      const onPointerMove = (event: PointerEvent) => {
        const bounds = host.getBoundingClientRect();
        pointerTarget.set(
          ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
          ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
        );
      };
      const onPointerLeave = () => pointerTarget.set(0, 0);
      const onVisibilityChange = () => updatePlayback();
      const onMotionChange = (event: MediaQueryListEvent) => {
        reducedMotion = event.matches;
        updatePlayback();
        render();
      };

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          updatePlayback();
        },
        { threshold: 0.02 },
      );
      intersectionObserver.observe(host);
      document.addEventListener("visibilitychange", onVisibilityChange);
      motionQuery.addEventListener("change", onMotionChange);
      if (!reducedMotion) {
        host.addEventListener("pointermove", onPointerMove);
        host.addEventListener("pointerleave", onPointerLeave);
      }

      resize();
      updatePlayback();
      window.requestAnimationFrame(() => setStatus("ready"));

      return () => {
        running = false;
        window.cancelAnimationFrame(animationId);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        motionQuery.removeEventListener("change", onMotionChange);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);

        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        const textures = new Set<THREE.Texture>();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
            geometries.add(object.geometry);
            const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
            objectMaterials.forEach((material) => {
              materials.add(material);
              Object.values(material).forEach((value) => {
                if (value instanceof THREE.Texture) textures.add(value);
              });
            });
          }
        });
        textures.forEach((texture) => texture.dispose());
        materials.forEach((material) => material.dispose());
        geometries.forEach((geometry) => geometry.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    } catch {
      renderer.dispose();
      renderer.domElement.remove();
      window.requestAnimationFrame(() => setStatus("error"));
    }
  }, []);

  return (
    <div className="absolute inset-0" ref={hostRef}>
      {status !== "ready" ? (
        <div className={`absolute inset-0 z-10 flex items-center justify-center ${status === "loading" ? "scene-loading" : ""}`} aria-hidden="true">
          <div className="relative h-40 w-28 rounded-[28px] border border-brand/10 bg-white/80 shadow-xl">
            <div className="absolute -top-5 left-1/2 h-7 w-[104px] -translate-x-1/2 rounded-lg bg-lime/80" />
            <div className="absolute left-2 right-2 top-16 h-16 rounded-lg bg-soft-blue">
              <div className="mx-auto mt-5 h-2 w-16 rounded-full bg-brand/30" />
              <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-olive/30" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
