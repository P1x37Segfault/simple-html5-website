window.addEventListener("load", () => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("playfield");
  /** @type {CanvasRenderingContext2D} */
  const context = canvas.getContext("2d");

  // Ball position
  let x, y;
  // Velocity
  let vx = 0;
  let vy = 0;
  // Drag
  let isDragging = false;
  let dragStartX, dragStartY;

  const BOUNCE = 0.8; // Bounce coefficient
  const FRICTION = 0.7; // Normal friction
  const GRASS_FRICTION = 0.95; // Higher friction for slow speeds
  const CRITICAL_SPEED = 2; // Speed threshold where grass friction kicks in
  let BALL_RADIUS; // Will be set in resizeCanvas
  const MAX_SHOOT_SPEED = 1.5; // Significantly reduced from 40
  const VELOCITY_THRESHOLD = 0.1; // Threshold for considering ball "stopped"
  const TRAIL_LENGTH = 50; // Number of positions to remember
  const trailPositions = []; // Array to store previous positions

  const playerImage = new Image();
  playerImage.src = "/assets/golf_ball.png";

  const RELATIVE_DRAG_DISTANCE = 0.25; // 25% of canvas width
  let MAX_DRAG_DISTANCE;

    /**
     * TODO:
     * - add option to enable / disable debug info
     * - fix inconsistent physics on ios / desktop
     * - add a hole to aim for
     * - add obstacles to avoid
     * - add random course generation stuff
     * - make the ball roll somehow
     */


  resizeCanvas(); // initial canvas on DOM loaded
  window.addEventListener("resize", resizeCanvas);

  function resizeCanvas() {
    // Calculate available space (accounting for margins)
    const margin = 80; // 40px padding on each side
    const availableSize = Math.min(
      window.innerWidth - margin,
      window.innerHeight - margin
    );

    canvas.width = availableSize;
    canvas.height = availableSize;

    BALL_RADIUS = availableSize / 20;
    MAX_DRAG_DISTANCE = availableSize * RELATIVE_DRAG_DISTANCE;

    x = availableSize / 2;
    y = availableSize / 2;
  }

  function drawCheckerboard() {
    const tileSize = canvas.width / 10; // 10x10 grid

    context.fillStyle = "#90EE90"; // Light green
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#82DD82"; // Darker green

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          context.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  let lastTime = performance.now();

  function updateGame() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background first
    drawCheckerboard();

    // Store current position and velocity in trail array
    if (!isDragging) {
      trailPositions.unshift({ x, y, vx, vy });
      if (trailPositions.length > TRAIL_LENGTH) {
        trailPositions.pop();
      }
    }

    // Draw trail
    trailPositions.forEach((pos, index) => {
      const alpha = ((TRAIL_LENGTH - index) / TRAIL_LENGTH) * 0.25;
      const radius = BALL_RADIUS * (1 - index / TRAIL_LENGTH); // Decreasing size

      context.beginPath();
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      context.fill();
    });

    // Reset alpha for the main ball
    context.globalAlpha = 1;

    // Update ball physics
    if (!isDragging) {
      // Apply velocity (scaled by deltaTime)
      x += vx * deltaTime * 60; // Scale to maintain same speed as 60fps
      y += vy * deltaTime * 60;

      // Calculate current speed
      const currentSpeed = Math.sqrt(vx * vx + vy * vy);

      // Apply appropriate friction based on speed
      const frameFriction = Math.pow(
        1 - (currentSpeed > CRITICAL_SPEED ? FRICTION : GRASS_FRICTION),
        deltaTime
      );
      vx *= frameFriction;
      vy *= frameFriction;

      // Force stop if very slow
      if (currentSpeed < VELOCITY_THRESHOLD) {
        vx = 0;
        vy = 0;
      }

      // Wall collisions
      if (x < BALL_RADIUS) {
        x = BALL_RADIUS;
        vx = Math.abs(vx) * BOUNCE;
      }
      if (x > canvas.width - BALL_RADIUS) {
        x = canvas.width - BALL_RADIUS;
        vx = -Math.abs(vx) * BOUNCE;
      }
      if (y < BALL_RADIUS) {
        y = BALL_RADIUS;
        vy = Math.abs(vy) * BOUNCE;
      }
      if (y > canvas.height - BALL_RADIUS) {
        y = canvas.height - BALL_RADIUS;
        vy = -Math.abs(vy) * BOUNCE;
      }
    }

    // Draw aiming line if dragging
    if (isDragging) {
      const dx = x - dragStartX;
      const dy = y - dragStartY;
      const dragDistance = Math.sqrt(dx * dx + dy * dy);
      const normalizedDistance = Math.min(dragDistance, MAX_DRAG_DISTANCE);

      // Calculate direction vector
      const dirX = dx / dragDistance;
      const dirY = dy / dragDistance;

      // Draw line with color based on power
      const power = normalizedDistance / MAX_DRAG_DISTANCE;
      let lineColor;
      if (power < 0.5) {
        // white
        lineColor = `rgba(255, 255, 255, 0.42)`;
      } else {
        // Interpolate between white and red
        const r = 255;
        const g = 255 - (power - 0.5) * 2 * 255;
        const b = 255 - (power - 0.5) * 2 * 255;
        lineColor = `rgba(${r}, ${g}, ${b}, 0.42)`;
      }

      // Draw line twice as long as the drag distance
      const displayLength = normalizedDistance * 2;

      context.beginPath();
      context.strokeStyle = lineColor;
      context.lineWidth = 10;
      context.moveTo(x, y);
      context.lineTo(x + dirX * displayLength, y + dirY * displayLength);
      context.stroke();
      context.lineWidth = 1;
    }

    // Draw current ball (on top of trail)
    context.save();
    context.translate(x, y);
    context.globalAlpha = 1;
    context.drawImage(
      playerImage,
      -BALL_RADIUS,
      -BALL_RADIUS,
      BALL_RADIUS * 2,
      BALL_RADIUS * 2
    );

    // Add black circle outline
    context.beginPath();
    context.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
    context.strokeStyle = "black";
    context.lineWidth = 2;
    context.stroke();

    context.restore();
  }

  function gameLoop() {
    updateGame();
    requestAnimationFrame(gameLoop);
  }

  function isBallStopped() {
    return (
      Math.abs(vx) < VELOCITY_THRESHOLD && Math.abs(vy) < VELOCITY_THRESHOLD
    );
  }

  // Remove devicemotion event listener and add touch events
  canvas.addEventListener("touchstart", (event) => {
    if (!isBallStopped()) return;
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.touches[0];

    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    // Check if touch is over ball
    const distToPlayer = Math.sqrt(
      Math.pow(touchX - x, 2) + Math.pow(touchY - y, 2)
    );

    if (distToPlayer < BALL_RADIUS) {
      isDragging = true;
      dragStartX = touchX;
      dragStartY = touchY;
    }
  });

  canvas.addEventListener("touchmove", (event) => {
    if (!isDragging) return;
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.touches[0];

    dragStartX = (touch.clientX - rect.left) * scaleX;
    dragStartY = (touch.clientY - rect.top) * scaleY;
  });

  canvas.addEventListener("touchend", (event) => {
    if (!isDragging) return;
    event.preventDefault();

    const dx = x - dragStartX;
    const dy = y - dragStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedDistance = Math.min(distance / canvas.width, RELATIVE_DRAG_DISTANCE);
    const power = normalizedDistance / RELATIVE_DRAG_DISTANCE;
    
    showDebugInfo(power);
    
    const velocity = calculateVelocity(dx, dy);
    vx = velocity.vx;
    vy = velocity.vy;
    isDragging = false;
  });

  // Fallback for desktop (mouse movement)
  function getCanvasCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // Replace canvas mousemove with shared logic
  function handleMouseMove(event) {
    const coords = getCanvasCoordinates(event.clientX, event.clientY);

    if (isDragging) {
      dragStartX = coords.x;
      dragStartY = coords.y;
    }
  }

  // Update event listeners to use shared handler
  canvas.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mousemove", handleMouseMove);

  // Update mousedown to use shared coordinate calculation
  canvas.addEventListener("mousedown", (event) => {
    if (!isBallStopped()) return;
    const coords = getCanvasCoordinates(event.clientX, event.clientY);

    // check if click is over ball
    const distToPlayer = Math.sqrt(
      Math.pow(coords.x - x, 2) + Math.pow(coords.y - y, 2)
    );

    if (distToPlayer < BALL_RADIUS) {
      dragStartX = coords.x;
      dragStartY = coords.y;
      isDragging = true;
    }
  });

  // Modify existing canvas mouseup to use shared function
  function handleMouseUp() {
    if (!isDragging) return;

    const dx = x - dragStartX;
    const dy = y - dragStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedDistance = Math.min(distance / canvas.width, RELATIVE_DRAG_DISTANCE);
    const power = normalizedDistance / RELATIVE_DRAG_DISTANCE;
    
    showDebugInfo(power);
    
    const velocity = calculateVelocity(dx, dy);
    vx = velocity.vx;
    vy = velocity.vy;
    isDragging = false;
  }

  // Update canvas mouseup to use shared function
  canvas.addEventListener("mouseup", handleMouseUp);

  // Add window-level mouseup handler
  window.addEventListener("mouseup", handleMouseUp);

  function calculateVelocity(dx, dy) {
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Normalize against canvas size for consistent behavior
    const normalizedDistance = Math.min(
      distance / canvas.width,
      RELATIVE_DRAG_DISTANCE
    );
    const power = normalizedDistance / RELATIVE_DRAG_DISTANCE;
    const speed = power * MAX_SHOOT_SPEED * 60;

    if (distance < 1 || power < 0.15) return { vx: 0, vy: 0 };

    return {
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
    };
  }

  const debugOverlay = document.getElementById("debug-overlay");
    
  function showDebugInfo(power) {
      debugOverlay.textContent = `Power: ${(power * 100).toFixed(1)}%`;
      debugOverlay.style.display = 'block';
      setTimeout(() => {
          debugOverlay.style.display = 'none';
      }, 2000);  // Hide after 2 seconds
  }

  // Start game loop immediately
  requestAnimationFrame(gameLoop);
});
