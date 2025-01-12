window.addEventListener("load", () => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("playfield");
  /** @type {CanvasRenderingContext2D} */
  const context = canvas.getContext("2d");

  /** game variables */
  let x = 5; // Ball position
  let y = 5;
  let vx = 0; // Velocity
  let vy = 0;
  let isDragging = false;
  let dragEndX, dragEndY; // Renamed variables

  /** game constants */
  const BOUNCE = 0.8; // Bounce coefficient
  const FRICTION = 0.7; // Normal friction
  const BALL_RADIUS = 0.5; // Will be set in resizeCanvas
  const GRASS_FRICTION = 0.95; // Higher friction for slow speeds
  const CRITICAL_SPEED = 2; // Speed threshold where grass friction kicks in
  const MAX_SHOOT_SPEED = 1.5;
  const VELOCITY_THRESHOLD = 0.1; // Threshold for considering ball "stopped"
  const TRAIL_LENGTH = 50; // Number of positions to remember
  const trailPositions = []; // Array to store previous positions
  const AIM_LINE_COLOR = "rgba(255, 255, 255, 0.75)"; // Transparency of aiming line
  const playerImage = new Image();
  const RELATIVE_DRAG_DISTANCE = 0.25; // 25% of canvas width
  const MAX_DRAG_DISTANCE = 50; // 5 units based on the 10x10 grid;
  playerImage.src = "/assets/golf_ball.png"; // setup

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
  }

  // Convert grid position to canvas position
  function gridToCanvas(gridX, gridY) {
    return {
      x: (gridX / 10) * canvas.width,
      y: (gridY / 10) * canvas.height,
    };
  }

  // Convert canvas position to grid position
  function canvasToGrid(canvasX, canvasY) {
    return {
      x: (canvasX / canvas.width) * 10,
      y: (canvasY / canvas.height) * 10,
    };
  }

  // draws a 10x10 checkerboard pattern on the canvas
  function drawCheckerboard() {
    const tileSize = canvas.width / 10;

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
      const canvasPos = gridToCanvas(pos.x, pos.y);

      context.beginPath();
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
      context.fill();
    });

    // Update ball physics
    if (!isDragging) {
      // Apply velocity (scaled by deltaTime)
      x += vx * deltaTime;
      y += vy * deltaTime;

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
      if (x < 0) {
        x = 0;
        vx = Math.abs(vx) * BOUNCE;
      }
      if (x > 10) {
        x = 10;
        vx = -Math.abs(vx) * BOUNCE;
      }
      if (y < 0) {
        y = 0;
        vy = Math.abs(vy) * BOUNCE;
      }
      if (y > 10) {
        y = 10;
        vy = -Math.abs(vy) * BOUNCE;
      }
    }

    // Draw aiming line if dragging
    if (isDragging) {
      drawAimLine();
    }

    // Draw current ball (on top of trail)
    const canvasPos = gridToCanvas(x, y);
    context.save();
    context.translate(canvasPos.x, canvasPos.y);
    const radius = (BALL_RADIUS / 10) * canvas.width;
    context.drawImage(playerImage, -radius, -radius, radius * 2, radius * 2);

    // Add black circle outline
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = "black";
    context.lineWidth = radius * 0.1;
    context.stroke();

    context.restore();

    // Update debug info
    updateDebugInfo();
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

  function getCanvasCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return canvasToGrid(
      (clientX - rect.left) * scaleX,
      (clientY - rect.top) * scaleY
    );
  }

  function handleMouseDown(event) {
    if (!isBallStopped()) return;
    const coords = getCanvasCoordinates(event.clientX, event.clientY);
    handleDragStart(coords.x, coords.y);
  }

  function handleMouseMove(event) {
    const coords = getCanvasCoordinates(event.clientX, event.clientY);
    handleDragMove(coords.x, coords.y);
  }

  function handleMouseUp() {
    handleDragEnd();
  }

  function handleTouchStart(event) {
    if (!isBallStopped()) return;
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.touches[0];

    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    const gridPos = canvasToGrid(touchX, touchY);

    handleDragStart(gridPos.x, gridPos.y);
  }

  function handleTouchMove(event) {
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.touches[0];

    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    const gridPos = canvasToGrid(touchX, touchY);

    handleDragMove(gridPos.x, gridPos.y);
  }

  function handleTouchEnd(event) {
    event.preventDefault();
    handleDragEnd();
  }

  // Add event listeners
  canvas.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);

  canvas.addEventListener("touchstart", handleTouchStart);
  canvas.addEventListener("touchmove", handleTouchMove);
  canvas.addEventListener("touchend", handleTouchEnd);

  function shootBall(dirX, dirY, power) {
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normalizedDirX = dirX / length;
    const normalizedDirY = dirY / length;
    const speed = power * MAX_SHOOT_SPEED;
    vx = normalizedDirX * speed;
    vy = normalizedDirY * speed;
  }

  const debugOverlay = document.getElementById("debug-overlay");
  function updateDebugInfo() {
    const velocity = Math.sqrt(vx * vx + vy * vy).toFixed(1);
    const posX = x.toFixed(1);
    const posY = y.toFixed(1);
    debugOverlay.textContent = `Position: (${posX}, ${posY})\nSpeed: ${velocity}`;
    debugOverlay.style.display = "block";
  }

  function drawAimLine() {
    const dx = x - dragEndX;
    const dy = y - dragEndY;
    const dragDistance = Math.sqrt(dx * dx + dy * dy);
    const normalizedDistance = Math.min(dragDistance, MAX_DRAG_DISTANCE);

    // Calculate direction vector
    const dirX = dx / dragDistance;
    const dirY = dy / dragDistance;

    const displayLength = normalizedDistance * 1.5;
    const ARROW_HEAD_SIZE = BALL_RADIUS * 1.5;
    const LINE_WIDTH = BALL_RADIUS / 2;

    // Draw line with gradient
    const canvasPos = gridToCanvas(x, y);
    const gradient = context.createLinearGradient(
      canvasPos.x,
      canvasPos.y,
      canvasPos.x + dirX * displayLength,
      canvasPos.y + dirY * displayLength
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)"); // Start transparent
    gradient.addColorStop(1, AIM_LINE_COLOR); // End more visible

    // Draw line stopping at the start of the arrow head
    context.beginPath();
    context.strokeStyle = gradient;
    context.lineWidth = LINE_WIDTH;
    context.moveTo(canvasPos.x, canvasPos.y);
    context.lineTo(
      canvasPos.x + dirX * (displayLength - ARROW_HEAD_SIZE),
      canvasPos.y + dirY * (displayLength - ARROW_HEAD_SIZE)
    );
    context.stroke();

    // Draw arrow head at the end of the line
    const angle = Math.atan2(dirY, dirX);
    context.fillStyle = AIM_LINE_COLOR;
    context.beginPath();
    context.moveTo(
      canvasPos.x + dirX * displayLength,
      canvasPos.y + dirY * displayLength
    );
    context.lineTo(
      canvasPos.x + dirX * displayLength - ARROW_HEAD_SIZE * Math.cos(angle - Math.PI / 6),
      canvasPos.y + dirY * displayLength - ARROW_HEAD_SIZE * Math.sin(angle - Math.PI / 6)
    );
    context.lineTo(
      canvasPos.x + dirX * displayLength - ARROW_HEAD_SIZE * Math.cos(angle + Math.PI / 6),
      canvasPos.y + dirY * displayLength - ARROW_HEAD_SIZE * Math.sin(angle + Math.PI / 6)
    );
    context.closePath();
    context.fill();
  }

  function handleDragStart(gridX, gridY) {
    // Check if touch is over ball
    const distToPlayer = Math.sqrt(
      Math.pow(gridX - x, 2) + Math.pow(gridY - y, 2)
    );

    if (distToPlayer < (BALL_RADIUS / canvas.width) * 10) {
      isDragging = true;
      dragEndX = gridX;
      dragEndY = gridY;
    }
  }

  function handleDragMove(gridX, gridY) {
    if (!isDragging) return;
    dragEndX = gridX;
    dragEndY = gridY;
  }

  function handleDragEnd() {
    if (!isDragging) return;

    const dx = x - dragEndX;
    const dy = y - dragEndY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedDistance = Math.min(distance, MAX_DRAG_DISTANCE);
    const power = normalizedDistance / MAX_DRAG_DISTANCE;

    shootBall(dx, dy, power);
    isDragging = false;
  }

  // Start game loop immediately
  requestAnimationFrame(gameLoop);
});
