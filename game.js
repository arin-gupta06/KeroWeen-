// ==========================================================================
// SILENT SHADOWS: THE SAMHAIN EXTRACTION
// Immersive Photographic First-Person Horror Engine (Three.js WebGL + WebRTC + Web Audio)
// ==========================================================================

class HorrorGame {
  constructor() {
    this.container = document.getElementById('game-container');

    // Game States & Objectives
    this.isPlaying = false;
    this.isDead = false;
    this.hasWon = false;
    this.hasKey = false;
    this.hasRelic = false;
    this.cryptUnlocked = false;

    // Current Room: 'corridor', 'bedroom', 'parlor', 'crypt'
    this.currentRoom = 'corridor';

    // First-Person Camera & Controls
    this.camera = null;
    this.scene = null;
    this.renderer = null;
    this.flashlight = null;
    this.flashlightTarget = null;
    this.isFlashlightOn = true;
    this.isCrouching = false;
    this.isSprinting = false;

    this.playerHeight = 1.7;
    this.crouchHeight = 1.1;
    this.velocity = new THREE.Vector3();
    this.keys = {};
    this.headBobTimer = 0;

    // Room Enclosure & Interactive Meshes
    this.roomSpheres = {};
    this.currentRoomMesh = null;
    this.roomTransitions = [];
    this.interactiveObjects = [];
    this.silverKeyMesh = null;
    this.relicMesh = null;
    this.relicLight = null;

    // Room-specific particle systems
    this.dustParticles = null;
    this.fireEmbers = null;
    this.greenSmoke = null;

    // Stalking Entity AI
    this.entity = null;
    this.entityState = 'PATROL'; // PATROL, INVESTIGATE, HUNT
    this.entityRoom = 'corridor';
    this.entityDistance = 18; // distance to player
    this.entitySpeed = 1.8;
    this.entityHuntSpeed = 4.8;
    this.entityGlow = null;
    this.entityEyeMat = null;
    this.entityStunTimer = 0;

    // Hardware Sensors
    this.micActive = false;
    this.camActive = false;
    this.audioCtx = null;
    this.analyser = null;
    this.micStream = null;
    this.micThreshold = 35;
    this.currentDecibels = 0;

    // Procedural Audio
    this.synthCtx = null;
    this.ambientDroneOsc = null;
    this.lastFootstepTime = 0;

    // Mouse Look (Euler Yaw / Pitch)
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.minPolarAngle = -Math.PI / 2.3;
    this.maxPolarAngle = Math.PI / 2.3;
    this.isLocked = false;

    this.clock = new THREE.Clock();

    this.initHUD();
    this.initHardwareSetup();
    this.initThree();
    this.buildImmersiveRooms();
    this.initEntity();
    this.setupEvents();
    this.switchRoom('corridor', false);
    this.animate();
  }

  // ------------------------------------------------------------------------
  // 1. Three.js Engine Setup
  // ------------------------------------------------------------------------
  initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, this.playerHeight, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.container.appendChild(this.renderer.domElement);

    // Dynamic Flashlight attached to camera
    this.flashlight = new THREE.SpotLight(0xfff5ea, 5.5, 50, Math.PI / 3.4, 0.35, 1.1);
    this.flashlight.position.set(0.15, -0.15, 0.1);
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -8);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    // Soft Proximity Fill Light (illuminates floor and immediate surroundings)
    this.playerFillLight = new THREE.PointLight(0xffeedd, 1.8, 12, 1.8);
    this.camera.add(this.playerFillLight);

    // Ambient Lighting
    this.ambientLight = new THREE.AmbientLight(0x505870, 1.2);
    this.scene.add(this.ambientLight);

    this.initParticleSystems();
  }

  initParticleSystems() {
    // 1. Dust motes in Corridor
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPos[i] = (Math.random() - 0.5) * 16;
      dustPos[i + 1] = Math.random() * 5;
      dustPos[i + 2] = (Math.random() - 0.5) * 16;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustParticles = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xcccccc, size: 0.05, transparent: true, opacity: 0.4 })
    );
    this.scene.add(this.dustParticles);

    // 2. Fire embers in Parlor
    const emberCount = 80;
    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount * 3; i += 3) {
      emberPos[i] = -4 + (Math.random() - 0.5) * 3;
      emberPos[i + 1] = Math.random() * 3;
      emberPos[i + 2] = -4 + (Math.random() - 0.5) * 3;
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    this.fireEmbers = new THREE.Points(
      emberGeo,
      new THREE.PointsMaterial({ color: 0xff6600, size: 0.08, transparent: true, opacity: 0.8 })
    );
    this.fireEmbers.visible = false;
    this.scene.add(this.fireEmbers);

    // 3. Green supernatural smoke in Crypt
    const greenCount = 100;
    const greenGeo = new THREE.BufferGeometry();
    const greenPos = new Float32Array(greenCount * 3);
    for (let i = 0; i < greenCount * 3; i += 3) {
      greenPos[i] = (Math.random() - 0.5) * 6;
      greenPos[i + 1] = -0.5 + Math.random() * 2.5;
      greenPos[i + 2] = -5 + (Math.random() - 0.5) * 6;
    }
    greenGeo.setAttribute('position', new THREE.BufferAttribute(greenPos, 3));
    this.greenSmoke = new THREE.Points(
      greenGeo,
      new THREE.PointsMaterial({ color: 0x39ff14, size: 0.12, transparent: true, opacity: 0.7 })
    );
    this.greenSmoke.visible = false;
    this.scene.add(this.greenSmoke);
  }

  // ------------------------------------------------------------------------
  // 2. Build High-Fidelity Photographic Room Chambers
  // ------------------------------------------------------------------------
  buildImmersiveRooms() {
    const texLoader = new THREE.TextureLoader();

    // Load the 4 exact photographic room assets
    const textures = {
      corridor: texLoader.load('assets/room_corridor.jpg'),
      bedroom: texLoader.load('assets/room_bedroom.jpg'),
      parlor: texLoader.load('assets/room_parlor.jpg'),
      crypt: texLoader.load('assets/room_crypt.jpg')
    };

    // Configure textures for maximum clarity
    Object.values(textures).forEach(tex => {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
    });

    // Create an immersive panoramic cylinder for each room
    const sphereRadius = 24;
    const cylinderGeo = new THREE.CylinderGeometry(sphereRadius, sphereRadius, 28, 48, 1, true);

    Object.keys(textures).forEach(roomId => {
      const mat = new THREE.MeshBasicMaterial({
        map: textures[roomId],
        side: THREE.BackSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(cylinderGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.roomSpheres[roomId] = mesh;
    });

    // Ground plane disc to ground the player
    const groundGeo = new THREE.CircleGeometry(sphereRadius, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111116,
      roughness: 0.9,
      metalness: 0.1
    });
    this.groundDisc = new THREE.Mesh(groundGeo, groundMat);
    this.groundDisc.rotation.x = -Math.PI / 2;
    this.groundDisc.position.y = 0;
    this.scene.add(this.groundDisc);

    // Ceiling disc
    this.ceilDisc = this.groundDisc.clone();
    this.ceilDisc.position.y = 14;
    this.scene.add(this.ceilDisc);

    // Build 3D Interactive Items
    this.buildProps();
  }

  buildProps() {
    // --- 1. The Glowing Silver Key (Located in Bedroom) ---
    const keyGroup = new THREE.Group();
    const keyHead = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.05, 8, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.95,
        roughness: 0.1,
        emissive: 0x88ccff,
        emissiveIntensity: 1.2
      })
    );
    const keyStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.9,
        emissive: 0x88ccff,
        emissiveIntensity: 1.0
      })
    );
    keyStem.position.y = -0.25;
    keyGroup.add(keyHead, keyStem);
    keyGroup.position.set(4.5, 1.1, -4.5); // On vanity in bedroom
    this.silverKeyMesh = keyGroup;
    this.silverKeyMesh.visible = false;
    this.scene.add(this.silverKeyMesh);

    this.keyLight = new THREE.PointLight(0x77bbff, 2.5, 6, 2.0);
    this.keyLight.position.set(4.5, 1.3, -4.5);
    this.keyLight.visible = false;
    this.scene.add(this.keyLight);

    // --- 2. The Cursed Horned Skull Relic (Located in Crypt) ---
    const skullGroup = new THREE.Group();
    const skullHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xd8dcb4,
        roughness: 0.5,
        emissive: 0x22ee33,
        emissiveIntensity: 0.7
      })
    );
    const hornL = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x161009, emissive: 0x113311 })
    );
    hornL.position.set(-0.48, 0.48, 0);
    hornL.rotation.z = 0.55;

    const hornR = hornL.clone();
    hornR.position.set(0.48, 0.48, 0);
    hornR.rotation.z = -0.55;

    // Emerald Glowing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
    eyeL.position.set(-0.18, 0.05, 0.45);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
    eyeR.position.set(0.18, 0.05, 0.45);

    skullGroup.add(skullHead, hornL, hornR, eyeL, eyeR);
    skullGroup.position.set(0, 1.1, -5.5); // On Crypt Altar
    this.relicMesh = skullGroup;
    this.relicMesh.visible = false;
    this.scene.add(this.relicMesh);

    this.relicLight = new THREE.PointLight(0x39ff14, 5.0, 14, 1.5);
    this.relicLight.position.set(0, 1.8, -5.5);
    this.relicLight.visible = false;
    this.scene.add(this.relicLight);

    // --- 3. Jack-o'-Lanterns (Carved Pumpkins with Candlelight) ---
    this.pumpkins = [];
    this.createJackOLantern(3.5, 0.35, -5);
    this.createJackOLantern(-3.5, 0.35, 4);
  }

  createJackOLantern(x, y, z) {
    const pumpkin = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xee5500, roughness: 0.5, emissive: 0x331100 })
    );
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.18, 5),
      new THREE.MeshStandardMaterial({ color: 0x224411 })
    );
    stem.position.y = 0.42;
    pumpkin.add(body, stem);
    pumpkin.position.set(x, y, z);
    this.scene.add(pumpkin);

    const light = new THREE.PointLight(0xff7700, 2.2, 8, 1.8);
    light.position.set(x, y + 0.15, z);
    this.scene.add(light);
    this.pumpkins.push({ mesh: pumpkin, light: light, base: 2.2 });
  }

  // ------------------------------------------------------------------------
  // 3. Seamless Room Switching & Doorway Management
  // ------------------------------------------------------------------------
  switchRoom(roomId, playSound = true) {
    if (playSound) this.playProceduralSound('door');

    this.currentRoom = roomId;

    // Toggle room cylinder visibility
    Object.keys(this.roomSpheres).forEach(id => {
      this.roomSpheres[id].visible = (id === roomId);
    });

    // Reset camera position to room center
    this.camera.position.set(0, this.playerHeight, 0);

    // Toggle Room-Specific Props and Lights
    const isBedroom = (roomId === 'bedroom');
    const isParlor = (roomId === 'parlor');
    const isCrypt = (roomId === 'crypt');
    const isCorridor = (roomId === 'corridor');

    // Particles
    if (this.dustParticles) this.dustParticles.visible = isCorridor;
    if (this.fireEmbers) this.fireEmbers.visible = isParlor;
    if (this.greenSmoke) this.greenSmoke.visible = isCrypt;

    // Props
    if (this.silverKeyMesh) {
      this.silverKeyMesh.visible = isBedroom && !this.hasKey;
      this.keyLight.visible = isBedroom && !this.hasKey;
    }
    if (this.relicMesh) {
      this.relicMesh.visible = isCrypt && !this.hasRelic;
      this.relicLight.visible = isCrypt && !this.hasRelic;
    }

    // Dynamic Atmosphere Tone
    if (isBedroom) {
      this.ambientLight.color.setHex(0x5577aa);
      this.ambientLight.intensity = 1.4;
      document.getElementById('obj-text').textContent = this.hasKey ? 'Return to the Corridor and unlock the Crypt.' : 'Explore the bedroom. Find the Silver Key on the vanity.';
    } else if (isParlor) {
      this.ambientLight.color.setHex(0x884411);
      this.ambientLight.intensity = 1.5;
      document.getElementById('obj-text').textContent = 'Victorian Parlor. Warm yourself by the fire, but listen closely.';
    } else if (isCrypt) {
      this.ambientLight.color.setHex(0x115522);
      this.ambientLight.intensity = 1.6;
      document.getElementById('obj-text').textContent = this.hasRelic ? 'ALARM! SPRINT BACK TO THE FRONT GATE TO ESCAPE!' : 'The Occult Crypt. Approach the Altar and grab the Cursed Horned Skull!';
    } else {
      // Corridor
      this.ambientLight.color.setHex(0x505870);
      this.ambientLight.intensity = 1.2;
      document.getElementById('obj-text').textContent = this.hasRelic ? 'RUN TO THE FRONT GATE AND ESCAPE!' : (this.hasKey ? 'Proceed forward to unlock the Crypt Gate.' : 'Explore the rooms. Parlor to the Left, Bedroom to the Right.');
    }

    // Setup Room Portals / Doorways
    this.setupRoomDoorways(roomId);
  }

  setupRoomDoorways(roomId) {
    this.interactiveObjects = [];

    if (roomId === 'corridor') {
      // 1. Enter Parlor (Left doorway)
      this.interactiveObjects.push({
        name: 'door_parlor',
        pos: new THREE.Vector3(-6, 1.2, 0),
        prompt: 'ENTER VICTORIAN PARLOR',
        action: () => this.switchRoom('parlor')
      });

      // 2. Enter Bedroom (Right doorway)
      this.interactiveObjects.push({
        name: 'door_bedroom',
        pos: new THREE.Vector3(6, 1.2, 0),
        prompt: 'ENTER MOONLIT BEDROOM',
        action: () => this.switchRoom('bedroom')
      });

      // 3. Unlock / Enter Crypt (Ahead at end of hall)
      this.interactiveObjects.push({
        name: 'door_crypt',
        pos: new THREE.Vector3(0, 1.2, -7),
        prompt: this.cryptUnlocked ? 'ENTER OCCULT CRYPT' : 'UNLOCK CRYPT GATE [REQUIRES SILVER KEY]',
        action: () => {
          if (this.cryptUnlocked) {
            this.switchRoom('crypt');
          } else if (this.hasKey) {
            this.cryptUnlocked = true;
            this.playProceduralSound('door');
            this.switchRoom('crypt');
          } else {
            document.getElementById('obj-text').textContent = 'GATE LOCKED! Go to the Moonlit Bedroom to find the Silver Key!';
          }
        }
      });

      // 4. Exit Manor Gate (Behind player)
      this.interactiveObjects.push({
        name: 'exit_gate',
        pos: new THREE.Vector3(0, 1.2, 7),
        prompt: this.hasRelic ? 'ESCAPE THE MANOR!' : 'LOCKED WITH HELL-CHAINS [REQUIRES CURSED SKULL]',
        action: () => {
          if (this.hasRelic) {
            this.triggerVictory();
          } else {
            document.getElementById('obj-text').textContent = 'The exit is sealed by an ancient curse! Retrieve the skull from the crypt first!';
          }
        }
      });
    } else {
      // In Bedroom, Parlor, or Crypt: Doorway leads back to Corridor
      this.interactiveObjects.push({
        name: 'door_corridor',
        pos: new THREE.Vector3(0, 1.2, 6.5),
        prompt: 'EXIT TO CORRIDOR',
        action: () => this.switchRoom('corridor')
      });

      // Special items in rooms:
      if (roomId === 'bedroom' && !this.hasKey) {
        this.interactiveObjects.push({
          name: 'silver_key',
          pos: new THREE.Vector3(4.5, 1.1, -4.5),
          prompt: 'PICK UP SILVER KEY',
          action: () => {
            this.hasKey = true;
            this.silverKeyMesh.visible = false;
            this.keyLight.visible = false;
            this.playProceduralSound('pickup');
            document.getElementById('obj-text').textContent = 'Silver Key Acquired! Return to the Corridor to unlock the Crypt.';
          }
        });
      }

      if (roomId === 'crypt' && !this.hasRelic) {
        this.interactiveObjects.push({
          name: 'cursed_relic',
          pos: new THREE.Vector3(0, 1.1, -5.5),
          prompt: 'GRAB THE CURSED HORNED SKULL [TRIGGER EXTRACTION]',
          action: () => {
            this.hasRelic = true;
            this.relicMesh.visible = false;
            this.relicLight.visible = false;
            this.playProceduralSound('relic');
            document.getElementById('obj-text').textContent = 'ALARM TRIGGERED! SPRINT TO THE FRONT DOOR TO ESCAPE!';
            this.alertEntity(this.camera.position, 'hunt');
          }
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  // 4. Stalking Entity AI (Shadow Monster)
  // ------------------------------------------------------------------------
  initEntity() {
    this.entity = new THREE.Group();

    // Tall shadowy silhouette
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.6, 2.6, 8);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x020104 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 1.3;

    // Glowing Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    this.entityEyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const eyeL = new THREE.Mesh(eyeGeo, this.entityEyeMat);
    eyeL.position.set(-0.14, 2.3, 0.3);
    const eyeR = new THREE.Mesh(eyeGeo, this.entityEyeMat);
    eyeR.position.set(0.14, 2.3, 0.3);

    this.entityGlow = new THREE.PointLight(0xff5500, 1.5, 6);
    this.entityGlow.position.set(0, 2.2, 0.3);

    this.entity.add(bodyMesh, eyeL, eyeR, this.entityGlow);
    this.entity.position.set(0, 0, -18);
    this.entity.visible = false;
    this.scene.add(this.entity);
  }

  updateEntity(delta) {
    if (!this.entity || this.isDead || this.hasWon) return;

    // Flashlight stun mechanic
    if (this.isFlashlightOn && this.entity.visible) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const toEntity = this.entity.position.clone().sub(this.camera.position).normalize();
      const dot = camDir.dot(toEntity);

      if (dot > 0.88 && this.entityDistance < 10 && this.entityStunTimer <= 0) {
        this.entityStunTimer = 2.0; // Stun for 2 seconds
        this.playProceduralSound('stun');
      }
    }

    if (this.entityStunTimer > 0) {
      this.entityStunTimer -= delta;
      return;
    }

    // Entity Room Tracking & Hunting
    if (this.entityState === 'HUNT') {
      this.entity.visible = true;
      this.entityEyeMat.color.setHex(0xff0000);
      this.entityGlow.color.setHex(0xff0000);

      // Advance directly towards camera
      const dir = this.camera.position.clone().sub(this.entity.position).normalize();
      this.entity.position.addScaledVector(dir, this.entityHuntSpeed * delta);
      this.entity.lookAt(this.camera.position.x, this.entity.position.y, this.camera.position.z);

      this.entityDistance = this.entity.position.distanceTo(this.camera.position);

      // Jumpscare collision
      if (this.entityDistance < 1.4) {
        this.triggerDeath();
      }
    } else if (this.entityState === 'INVESTIGATE') {
      this.entity.visible = (this.entityRoom === this.currentRoom);
      this.entityEyeMat.color.setHex(0xff7700);
      this.entityGlow.color.setHex(0xff7700);

      const dir = this.camera.position.clone().sub(this.entity.position).normalize();
      this.entity.position.addScaledVector(dir, this.entitySpeed * delta);
      this.entity.lookAt(this.camera.position.x, this.entity.position.y, this.camera.position.z);

      if (this.entity.position.distanceTo(this.camera.position) < 1.4) {
        this.triggerDeath();
      }
    } else {
      // PATROL: Entity stays in background
      this.entity.visible = false;
    }
  }

  alertEntity(soundOrigin, severity = 'investigate') {
    if (this.isDead || this.hasWon) return;

    const alertBanner = document.getElementById('threat-alert');

    if (severity === 'hunt' || this.hasRelic) {
      this.entityState = 'HUNT';
      this.entityRoom = this.currentRoom;
      this.entity.position.set(0, 0, -14).applyQuaternion(this.camera.quaternion).add(this.camera.position);
      this.entity.position.y = 0;
      this.entity.visible = true;

      alertBanner.textContent = '⚠️ ENTITY DETECTED YOUR VOICE! IT IS SPRINTING FOR YOU! ⚠️';
      alertBanner.style.display = 'block';
      this.playProceduralSound('roar');
    } else {
      if (this.entityState !== 'HUNT') {
        this.entityState = 'INVESTIGATE';
        this.entityRoom = this.currentRoom;
        this.entity.position.set(0, 0, -16).applyQuaternion(this.camera.quaternion).add(this.camera.position);
        this.entity.position.y = 0;
        this.entity.visible = true;

        alertBanner.textContent = '⚠️ HEARD A SOUND! ENTITY IS INVESTIGATING! ⚠️';
        alertBanner.style.display = 'block';
        this.playProceduralSound('growl');

        setTimeout(() => {
          if (this.entityState === 'INVESTIGATE') {
            this.entityState = 'PATROL';
            this.entity.visible = false;
            alertBanner.style.display = 'none';
          }
        }, 5500);
      }
    }
  }

  // ------------------------------------------------------------------------
  // 5. Player Controls, Walking & Interaction
  // ------------------------------------------------------------------------
  setupEvents() {
    this.container.addEventListener('click', () => {
      if (!this.isLocked && this.isPlaying && !this.isDead && !this.hasWon) {
        this.container.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = (document.pointerLockElement === this.container);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      this.euler.y -= movementX * 0.0024;
      this.euler.x -= movementY * 0.0024;
      this.euler.x = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.euler.x));

      this.camera.quaternion.setFromEuler(this.euler);
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Toggle Crouch (C or Control)
      if (e.code === 'KeyC' || e.code === 'ControlLeft') {
        this.isCrouching = !this.isCrouching;
        document.getElementById('stance-indicator').textContent = this.isCrouching ? 'STANCE: CROUCHING (SILENT)' : 'STANCE: STANDING';
      }

      // Toggle Flashlight (F)
      if (e.code === 'KeyF') {
        this.isFlashlightOn = !this.isFlashlightOn;
        this.flashlight.intensity = this.isFlashlightOn ? 5.5 : 0;
        if (this.playerFillLight) this.playerFillLight.intensity = this.isFlashlightOn ? 1.8 : 0.8;
        this.playProceduralSound('click');
      }

      // Interact (E)
      if (e.code === 'KeyE') {
        this.triggerCurrentInteraction();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (this.isLocked && e.button === 0) {
        this.triggerCurrentInteraction();
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateMovement(delta) {
    if (!this.isLocked || this.isDead || this.hasWon) return;

    this.isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isCrouching;

    let targetSpeed = 3.6;
    if (this.isCrouching) targetSpeed = 1.8;
    else if (this.isSprinting) targetSpeed = 6.2;

    const moveZ = Number(!!this.keys['KeyW'] || !!this.keys['ArrowUp']) - Number(!!this.keys['KeyS'] || !!this.keys['ArrowDown']);
    const moveX = Number(!!this.keys['KeyD'] || !!this.keys['ArrowRight']) - Number(!!this.keys['KeyA'] || !!this.keys['ArrowLeft']);

    // Camera height adjustment for crouching
    const targetHeight = this.isCrouching ? this.crouchHeight : this.playerHeight;
    this.camera.position.y += (targetHeight - this.camera.position.y) * 10 * delta;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const moveVector = new THREE.Vector3();
    if (moveZ !== 0) moveVector.addScaledVector(forward, moveZ);
    if (moveX !== 0) moveVector.addScaledVector(right, moveX);

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().multiplyScalar(targetSpeed * delta);
      
      const newPos = this.camera.position.clone().add(moveVector);

      // Clamp movement within room sphere (radius 7.5m)
      const distFromCenter = new THREE.Vector2(newPos.x, newPos.z).length();
      if (distFromCenter < 7.5) {
        this.camera.position.x = newPos.x;
        this.camera.position.z = newPos.z;
      }

      // Head Bobbing
      this.headBobTimer += delta * (this.isSprinting ? 14 : 9);
      const bob = Math.sin(this.headBobTimer) * (this.isSprinting ? 0.08 : 0.04);
      this.camera.position.y += bob;

      // Footstep Sounds
      const interval = this.isSprinting ? 320 : (this.isCrouching ? 680 : 480);
      const now = performance.now();
      if (now - this.lastFootstepTime > interval) {
        this.lastFootstepTime = now;
        if (!this.isCrouching) {
          this.playProceduralSound('footstep');
          if (this.isSprinting) {
            this.alertEntity(this.camera.position, 'investigate');
          }
        }
      }
    }
  }

  checkRaycastInteractions() {
    if (!this.isLocked || this.isDead || this.hasWon) return;

    // Raycast from camera center
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const promptEl = document.getElementById('interact-prompt');
    const promptText = document.getElementById('prompt-text');
    const reticle = document.getElementById('reticle');

    let closest = null;
    let minAngle = 0.35; // cone angle in radians

    for (let item of this.interactiveObjects) {
      const toItem = item.pos.clone().sub(this.camera.position);
      const dist = toItem.length();
      if (dist < 8.0) {
        toItem.normalize();
        const angle = camDir.angleTo(toItem);
        if (angle < minAngle) {
          minAngle = angle;
          closest = item;
        }
      }
    }

    if (closest) {
      this.currentInteractable = closest;
      promptText.textContent = closest.prompt;
      promptEl.style.display = 'block';
      reticle.classList.add('highlight');
    } else {
      this.currentInteractable = null;
      promptEl.style.display = 'none';
      reticle.classList.remove('highlight');
    }
  }

  triggerCurrentInteraction() {
    if (this.currentInteractable && this.currentInteractable.action) {
      this.currentInteractable.action();
    }
  }

  // ------------------------------------------------------------------------
  // 6. Microphone & Bodycam Hardware Integration
  // ------------------------------------------------------------------------
  initHardwareSetup() {
    const btnMic = document.getElementById('btn-toggle-mic');
    const btnCam = document.getElementById('btn-toggle-cam');
    const micLabel = document.getElementById('mic-status-label');
    const camLabel = document.getElementById('cam-status-label');

    btnMic.addEventListener('click', async () => {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.setupAudioAnalyser(this.micStream);
        this.micActive = true;
        btnMic.classList.add('active');
        micLabel.textContent = 'Active (Live decibels connected)';
      } catch (err) {
        console.warn('Microphone error:', err);
        alert('Could not access microphone. The game will still detect your in-game movement noise!');
      }
    });

    btnCam.addEventListener('click', async () => {
      const videoEl = document.getElementById('webcam-stream');
      const fallback = document.getElementById('cam-fallback');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 480 }, height: { ideal: 360 } }
        });
        videoEl.srcObject = stream;
        videoEl.style.display = 'block';
        fallback.style.display = 'none';
        this.camActive = true;
        btnCam.classList.add('active');
        camLabel.textContent = 'Active (Night-Vision live)';
      } catch (err) {
        console.warn('Camera error:', err);
        alert('Could not access camera. Simulation mode will run.');
      }
    });
  }

  setupAudioAnalyser(stream) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.25;
    source.connect(this.analyser);
  }

  updateMicrophoneTracking() {
    let decibels = 0;

    if (this.micActive && this.analyser) {
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);
      decibels = Math.min(100, Math.round((rms / 128) * 100));
    }

    this.currentDecibels = decibels;

    // HUD Update
    const fill = document.getElementById('audio-fill');
    const dbNum = document.getElementById('db-display');
    const status = document.getElementById('audio-status');
    const menuFill = document.getElementById('menu-mic-fill');

    if (fill) fill.style.width = `${Math.max(4, decibels)}%`;
    if (dbNum) dbNum.textContent = `${decibels} dB`;
    if (menuFill) menuFill.style.width = `${decibels}%`;

    // Alert thresholds
    if (decibels >= this.micThreshold) {
      if (status) {
        status.textContent = 'CRITICAL • TOO LOUD!';
        status.style.color = '#ff2b2b';
      }
      this.alertEntity(this.camera.position, decibels > 55 ? 'hunt' : 'investigate');
    } else if (decibels > this.micThreshold * 0.5) {
      if (status) {
        status.textContent = 'CAUTION • BREATHING AUDIBLE';
        status.style.color = '#ffaa00';
      }
    } else {
      if (status) {
        status.textContent = 'SAFE • STAY SILENT';
        status.style.color = '#39ff14';
      }
    }
  }

  // ------------------------------------------------------------------------
  // 7. Procedural Web Audio Engine
  // ------------------------------------------------------------------------
  playProceduralSound(type) {
    if (!this.synthCtx) {
      this.synthCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.synthCtx.state === 'suspended') this.synthCtx.resume();

    const t = this.synthCtx.currentTime;

    if (type === 'footstep') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'door') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.linearRampToValueAtTime(110, t + 0.35);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (type === 'click') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } else if (type === 'pickup' || type === 'relic') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(type === 'relic' ? 680 : 550, t + 0.6);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    } else if (type === 'growl' || type === 'roar' || type === 'jumpscare') {
      const osc1 = this.synthCtx.createOscillator();
      const osc2 = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      const startFreq = (type === 'jumpscare') ? 950 : 220;
      const endFreq = (type === 'jumpscare') ? 140 : 65;

      osc1.frequency.setValueAtTime(startFreq, t);
      osc1.frequency.exponentialRampToValueAtTime(endFreq, t + 0.9);
      osc2.frequency.setValueAtTime(startFreq + 40, t);
      osc2.frequency.exponentialRampToValueAtTime(endFreq - 20, t + 0.9);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 1.0);
      osc2.stop(t + 1.0);
    }
  }

  startAmbientDrone() {
    if (!this.synthCtx) {
      this.synthCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.synthCtx.state === 'suspended') this.synthCtx.resume();

    const osc = this.synthCtx.createOscillator();
    const filter = this.synthCtx.createBiquadFilter();
    const gain = this.synthCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, this.synthCtx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, this.synthCtx.currentTime);
    gain.gain.setValueAtTime(0.12, this.synthCtx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthCtx.destination);
    osc.start();
  }

  // ------------------------------------------------------------------------
  // 8. Game Loop & States
  // ------------------------------------------------------------------------
  initHUD() {
    const btnPlay = document.getElementById('btn-play-game');
    const startModal = document.getElementById('start-menu');
    const btnRetry = document.getElementById('btn-retry');
    const btnPlayAgain = document.getElementById('btn-play-again');

    btnPlay.addEventListener('click', () => {
      startModal.style.display = 'none';
      this.isPlaying = true;
      this.startAmbientDrone();
      this.container.requestPointerLock();
    });

    btnRetry.addEventListener('click', () => {
      location.reload();
    });

    btnPlayAgain.addEventListener('click', () => {
      location.reload();
    });

    setInterval(() => {
      const bpmEl = document.getElementById('hud-bpm');
      if (bpmEl) {
        const isHunting = (this.entityState === 'HUNT');
        const base = isHunting ? 152 : 94;
        const jitter = Math.floor(Math.random() * 8) - 4;
        bpmEl.textContent = `♥ ${base + jitter} BPM`;
      }
    }, 1100);
  }

  triggerDeath() {
    this.isDead = true;
    this.playProceduralSound('jumpscare');

    const scareOverlay = document.getElementById('jumpscare-overlay');
    scareOverlay.style.display = 'block';

    setTimeout(() => {
      scareOverlay.style.display = 'none';
      document.exitPointerLock();
      document.getElementById('game-over-modal').style.display = 'flex';
    }, 1200);
  }

  triggerVictory() {
    this.hasWon = true;
    document.exitPointerLock();
    document.getElementById('victory-modal').style.display = 'flex';
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.isPlaying && !this.isDead && !this.hasWon) {
      this.updateMovement(delta);
      this.checkRaycastInteractions();
      this.updateEntity(delta);
      this.updateMicrophoneTracking();

      // Animate Particles
      if (this.fireEmbers && this.fireEmbers.visible) {
        const pos = this.fireEmbers.geometry.attributes.position.array;
        for (let i = 1; i < pos.length; i += 3) {
          pos[i] += delta * 0.8;
          if (pos[i] > 3.0) pos[i] = 0;
        }
        this.fireEmbers.geometry.attributes.position.needsUpdate = true;
      }

      if (this.greenSmoke && this.greenSmoke.visible) {
        const pos = this.greenSmoke.geometry.attributes.position.array;
        for (let i = 1; i < pos.length; i += 3) {
          pos[i] += delta * 0.5;
          if (pos[i] > 2.5) pos[i] = -0.5;
        }
        this.greenSmoke.geometry.attributes.position.needsUpdate = true;
      }

      // Pumpkin Candlelight Flicker
      for (let p of this.pumpkins) {
        p.light.intensity = p.base + (Math.random() - 0.5) * 0.4;
      }

      // Rotate Silver Key and Relic
      if (this.silverKeyMesh && this.silverKeyMesh.visible) {
        this.silverKeyMesh.rotation.y += delta * 1.6;
      }
      if (this.relicMesh && this.relicMesh.visible) {
        this.relicMesh.rotation.y += delta * 0.9;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Start Game on load
window.addEventListener('load', () => {
  new HorrorGame();
});
