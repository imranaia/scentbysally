// 3D.js - Three.js functionality for Scentbysally

// Global variables
let scene, camera, renderer;
let perfumes = [];
let rotationSpeed = 0.002;

// Initialize 3D slideshow on homepage
function init3DSlideshow(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 2, 15);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;

  // Lights
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  const backLight = new THREE.PointLight(0xffffff, 0.5);
  backLight.position.set(-5, 0, -5);
  scene.add(backLight);

  // Add floating particles for effect
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 1000;
  const posArray = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 50;
    posArray[i + 1] = (Math.random() - 0.5) * 30;
    posArray[i + 2] = (Math.random() - 0.5) * 50 - 20;
  }

  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(posArray, 3),
  );
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true,
    opacity: 0.3,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // Create perfume bottles (simplified geometry for now)
  createPerfumeBottles();

  // Start animation
  animate();
}

// Create perfume bottles
function createPerfumeBottles() {
  const bottleCount = 5;
  const colors = [0xffffff, 0xcccccc, 0x999999, 0x666666, 0x333333];

  for (let i = 0; i < bottleCount; i++) {
    // Create a group for each perfume bottle
    const group = new THREE.Group();

    // Bottle body (cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(0.8, 0.8, 2, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: colors[i % colors.length],
      shininess: 60,
      transparent: true,
      opacity: 0.8,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 1;
    group.add(body);

    // Bottle neck (smaller cylinder)
    const neckGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 16);
    const neckMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 80,
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.castShadow = true;
    neck.receiveShadow = true;
    neck.position.y = 2.25;
    group.add(neck);

    // Bottle cap (cylinder)
    const capGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const capMaterial = new THREE.MeshPhongMaterial({
      color: 0x000000,
      shininess: 100,
      emissive: 0x111111,
    });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.castShadow = true;
    cap.receiveShadow = true;
    cap.position.y = 2.65;
    group.add(cap);

    // Position in a circle
    const angle = (i / bottleCount) * Math.PI * 2;
    const radius = 3;
    group.position.x = Math.sin(angle) * radius;
    group.position.z = Math.cos(angle) * radius;
    group.position.y = 0;

    // Rotate to face center
    group.rotation.y = -angle;

    // Add slight random rotation
    group.rotation.x = Math.sin(i) * 0.1;

    scene.add(group);

    // Store for animation
    perfumes.push({
      group,
      baseY: group.position.y,
      speed: 0.5 + Math.random() * 0.5,
      phase: i * 2,
    });
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Rotate perfumes slowly
  perfumes.forEach((perfume, index) => {
    // Floating animation
    perfume.group.position.y =
      perfume.baseY + Math.sin(Date.now() * 0.002 + perfume.phase) * 0.2;

    // Gentle rotation
    perfume.group.rotation.y += rotationSpeed * (index % 2 === 0 ? 1 : -1);
  });

  // Rotate particles
  // particles.rotation.y += 0.0001;

  renderer.render(scene, camera);
}

// Product page 3D viewer
function initProductViewer(canvasId, productId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Similar setup but with interactive controls
  // This would load specific product model

  console.log("Product viewer initialized for product:", productId);
}

// Handle window resize
window.addEventListener("resize", () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});
